// lib/account-status.ts
// #304 — Source UNIQUE de vérité sur l'état d'un compte.
//
// Avant : `UserStatus` (ACTIVE / BLOCKED / SUSPENDED) était écrit par
// l'interface d'administration mais jamais LU. Un compte banni conservait donc
// sa session et pouvait continuer à appeler les routes utilisateur.
//
// Ce module centralise :
//   - la liste des statuts bloquants (`BLOCKING_STATUSES`) ;
//   - l'évaluation d'accès d'un compte (`isAccountAllowed` /
//     `evaluateAccountAccess`), y compris l'EXPIRATION d'une suspension
//     (`banExpires`) ;
//   - la RÉVOCATION des sessions (au changement de statut ET à la connexion) ;
//   - la purge automatique d'une suspension arrivée à échéance.
//
// Le champ `status` est l'autorité applicative ; le champ `banned` (plugin
// admin Better Auth) est lu en complément pour rester compatible avec les
// bannissements posés via l'API Better Auth.
import { prisma } from "@/lib/prisma";

/** Tous les statuts possibles d'un compte (miroir de l'enum Prisma). */
export const USER_STATUSES = ["ACTIVE", "BLOCKED", "SUSPENDED"] as const;
export type UserStatusValue = (typeof USER_STATUSES)[number];

/** Statuts qui interdisent toute authentification et toute action métier. */
export const BLOCKING_STATUSES = ["BLOCKED", "SUSPENDED"] as const;
export type BlockingStatus = (typeof BLOCKING_STATUSES)[number];

/** Cause du refus, ou motif de ré-autorisation. */
export type AccountBlockReason =
  | "ACTIVE"
  | "BLOCKED"
  | "SUSPENDED"
  | "BANNED"
  | "SUSPENDED_EXPIRED"
  | "NOT_FOUND"
  | "STATUS_UNKNOWN";

/** Projection minimale d'un utilisateur nécessaire à la décision d'accès. */
export type AccountRecord = {
  id?: string;
  status?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
};

export type AccountAccessDecision = {
  /** false = aucune authentification ni action autorisée. */
  allowed: boolean;
  /** Statut retenu (ACTIVE si le statut stocké est absent/inconnu). */
  status: UserStatusValue;
  reason: AccountBlockReason;
  /** Date de fin de suspension / bannissement, si elle existe. */
  banExpires: Date | null;
  /** true si une suspension/bannissement a expiré et doit être purgé. */
  expired: boolean;
  /** Motif administratif (jamais renvoyé tel quel au client). */
  detail: string | null;
  user: AccountRecord | null;
};

const ACCOUNT_SELECT = {
  id: true,
  status: true,
  banned: true,
  banReason: true,
  banExpires: true,
} as const;

/**
 * Accès minimal au client Prisma utilisé ici. Le cast évite de coupler ce
 * module au client généré complet (et garde les tests easily mockables).
 */
type AccountDelegate = {
  findUnique: (args: {
    where: { id: string } | { email: string };
    select: Record<string, boolean>;
  }) => Promise<AccountRecord | null>;
  update: (args: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

type SessionDelegate = {
  deleteMany: (args: { where: { userId: string } }) => Promise<{ count: number }>;
};

type AccountClient = {
  user?: Partial<AccountDelegate>;
  session?: Partial<SessionDelegate>;
};

function accountClient(): AccountClient {
  return prisma as unknown as AccountClient;
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === "function";
}

/** Le statut est-il bloquant ? (insensible à la casse) */
export function isBlockingStatus(status: unknown): boolean {
  return (
    typeof status === "string" &&
    (BLOCKING_STATUSES as readonly string[]).includes(status.toUpperCase())
  );
}

function normalizeStatus(status: unknown): UserStatusValue {
  if (typeof status !== "string") return "ACTIVE";
  const upper = status.toUpperCase();
  return (USER_STATUSES as readonly string[]).includes(upper)
    ? (upper as UserStatusValue)
    : "ACTIVE";
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Évalue l'accès d'un compte à partir de son enregistrement.
 * Pure (aucun accès base) : c'est le point de décision testable.
 *
 * @param user  Projection de l'utilisateur (status / banned / banExpires)
 * @param now   Date de référence (injectable pour les tests)
 */
export function evaluateAccountAccess(
  user: AccountRecord | null | undefined,
  now: Date = new Date(),
): AccountAccessDecision {
  if (!user) {
    return {
      allowed: false,
      status: "ACTIVE",
      reason: "NOT_FOUND",
      banExpires: null,
      expired: false,
      detail: null,
      user: null,
    };
  }

  const status = normalizeStatus(user.status);
  const banExpires = toDate(user.banExpires);
  const expired = banExpires !== null && banExpires.getTime() <= now.getTime();
  const detail = user.banReason || null;
  const base = { status, banExpires, expired, detail, user };

  // Suspension expirée : le compte redevient actif (et sera purgé en base).
  if (expired) {
    return { ...base, allowed: true, reason: "SUSPENDED_EXPIRED" };
  }

  // Bannissement posé via le plugin admin Better Auth (champ `banned`).
  if (user.banned === true) {
    return { ...base, allowed: false, reason: "BANNED" };
  }

  if (isBlockingStatus(status)) {
    return {
      ...base,
      allowed: false,
      reason: status === "BLOCKED" ? "BLOCKED" : "SUSPENDED",
    };
  }

  return { ...base, allowed: true, reason: "ACTIVE" };
}

/** Raccourci booléen : le compte peut-il s'authentifier et agir ? */
export function isAccountAllowed(
  user: AccountRecord | null | undefined,
  now: Date = new Date(),
): boolean {
  return evaluateAccountAccess(user, now).allowed;
}

/** Message utilisateur (français), volontairement générique. */
export function accountBlockMessage(decision: AccountAccessDecision): string {
  switch (decision.reason) {
    case "BLOCKED":
    case "BANNED":
      return "Votre compte est bloqué. Contactez l'administration.";
    case "SUSPENDED":
      return "Votre compte est suspendu. Contactez l'administration.";
    case "NOT_FOUND":
      return "Compte introuvable.";
    default:
      return "Votre compte n'est pas autorisé à effectuer cette action.";
  }
}

/** Message d'erreur technique (logs / audit). */
export function accountBlockLogMessage(decision: AccountAccessDecision): string {
  return `[ACCOUNT_BLOCKED] user=${decision.user?.id ?? "?"} status=${decision.status} reason=${decision.reason}`;
}

/**
 * Supprime TOUTES les sessions d'un utilisateur.
 * Appelée au changement de statut (bannissement) et à chaque tentative
 * d'exploitation d'une session par un compte bloqué.
 *
 * @returns nombre de sessions révoquées (0 si la révoque échoue)
 */
export async function revokeUserSessions(
  userId: string,
  client?: AccountClient,
): Promise<number> {
  const delegate = (client ?? accountClient()).session;
  if (!delegate || !isFunction(delegate.deleteMany)) {
    console.error("[ACCOUNT_BLOCKED] client Prisma indisponible (sessions)");
    return 0;
  }

  try {
    const result = await delegate.deleteMany({ where: { userId } });
    return typeof result?.count === "number" ? result.count : 0;
  } catch (error) {
    console.error("[ACCOUNT_BLOCKED] révocation des sessions impossible:", error);
    return 0;
  }
}

/** Purge une suspension/bannissement arrivé à échéance. */
async function purgeExpiredBlock(
  userId: string,
  client?: AccountClient,
): Promise<void> {
  const delegate = (client ?? accountClient()).user;
  if (!delegate || !isFunction(delegate.update)) return;

  try {
    await delegate.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
        banned: false,
        banReason: null,
        banExpires: null,
      },
    });
    console.log(`[ACCOUNT_STATUS] suspension expirée purgée pour ${userId}`);
  } catch (error) {
    console.error("[ACCOUNT_STATUS] purge de suspension impossible:", error);
  }
}

async function fetchAccount(
  where: { id: string } | { email: string },
  now: Date,
  client?: AccountClient,
): Promise<AccountAccessDecision> {
  const delegate = (client ?? accountClient()).user;

  if (!delegate || !isFunction(delegate.findUnique)) {
    // Impossible de lire le statut (base injoignable ou non configurée).
    // On n'aggrave pas la panne : une session valide reste valide.
    console.error("[ACCOUNT_STATUS] lecture du statut impossible");
    return {
      allowed: true,
      status: "ACTIVE",
      reason: "STATUS_UNKNOWN",
      banExpires: null,
      expired: false,
      detail: null,
      user: null,
    };
  }

  try {
    const user = await delegate.findUnique({ where, select: { ...ACCOUNT_SELECT } });
    return evaluateAccountAccess(user, now);
  } catch (error) {
    console.error("[ACCOUNT_STATUS] lecture du statut impossible:", error);
    return {
      allowed: true,
      status: "ACTIVE",
      reason: "STATUS_UNKNOWN",
      banExpires: null,
      expired: false,
      detail: null,
      user: null,
    };
  }
}

/** Décision d'accès pour un identifiant utilisateur. */
export function getAccountAccess(
  userId: string,
  now: Date = new Date(),
  client?: AccountClient,
): Promise<AccountAccessDecision> {
  return fetchAccount({ id: userId }, now, client);
}

/** Décision d'accès pour une adresse e-mail (flux de connexion OTP / FSA). */
export function getAccountAccessByEmail(
  email: string,
  now: Date = new Date(),
  client?: AccountClient,
): Promise<AccountAccessDecision> {
  return fetchAccount({ email }, now, client);
}

/**
 * Point d'entrée utilisé par l'authentification et par les routes :
 *   - purge la suspension expirée ;
 *   - révoque les sessions vivantes si le compte est bloqué ;
 *   - renvoie la décision.
 */
export async function enforceAccountStatus(
  userId: string,
  now: Date = new Date(),
  client?: AccountClient,
): Promise<AccountAccessDecision> {
  const decision = await getAccountAccess(userId, now, client);

  if (decision.reason === "SUSPENDED_EXPIRED" && decision.user?.id) {
    await purgeExpiredBlock(decision.user.id, client);
  }

  if (!decision.allowed) {
    console.warn(accountBlockLogMessage(decision));
    // Un compte introuvable n'a pas de session à révoquer.
    if (decision.reason !== "NOT_FOUND") {
      await revokeUserSessions(userId, client);
    }
  }

  return decision;
}
