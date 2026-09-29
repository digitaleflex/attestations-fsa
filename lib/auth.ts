// lib/auth.ts
// Configuration unifiée de l'authentification avec Better Auth + Fallback Legacy
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { rawPrisma } from "@/lib/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { normalizeEmailVerified, isEmailVerified } from "@/lib/email-verified";

// ✅ FIX: Define typed session user to eliminate `as any` casts
export type SessionUser = {
  id: string;
  email: string | null;
  name?: string | null;
  role: "ADMIN" | "USER" | string;
  emailVerified?: boolean;
};

export type SessionData = {
  user: SessionUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
};

// Vérification de la clé secrète
const authSecret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
if (!authSecret && process.env.NODE_ENV === "production") {
  throw new Error(
    "BETTER_AUTH_SECRET or AUTH_SECRET must be set in production environment",
  );
}
if (!authSecret && process.env.NODE_ENV === "development") {
  console.warn(
    "⚠️ [AUTH WARN] BETTER_AUTH_SECRET or AUTH_SECRET is not defined. Using dev-only fallback.",
  );
}

import { admin, twoFactor } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import {
  accountBlockMessage,
  accountBlockLogMessage,
  enforceAccountStatus,
  type AccountAccessDecision,
} from "@/lib/account-status";

// ─────────────────────────────────────────────────────────────────────────────
// #283 — trustedOrigins : allowlist EXACTE en production
// ─────────────────────────────────────────────────────────────────────────────
//
// Risque : `https://*.vercel.app`, `https://*.loca.lt` ou `http://192.168.0.*`
// dans `trustedOrigins` autorisent un site tiers à piloter des requêtes
// cross-site authentifiées (CSRF / vol de session) sur n'importe quel
// sous-domaine de ces hébergeurs. En production, seuls des domaines EXACTS
// déclarés par le déploiement sont acceptés ; les jokers sont réservés au
// développement (NODE_ENV !== "production").
//
// Configuration (voir .env.example et docs/security/01-mesures-securite.md) :
//   APP_URL / NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL
//       → origine(s) de l'application (exactes).
//   BETTER_AUTH_TRUSTED_ORIGINS / AUTH_TRUSTED_ORIGINS
//       → liste d'origines supplémentaires séparées par des virgules
//         (ex. « https://attestations.fermestandre.com/verifier »).
//   BETTER_AUTH_TRUST_ORIGINS_ALLOW_WILDCARDS="true"
//       → échappatoire EXPLICITE en production, à réserver au cas d'un
//         déploiement multi-tenant sur un domaine à jokers. Refusée par défaut.
//
// Second risque, traité par la MÊME porte : le SCHÉMA. Une origine `http://`
// est en clair — les cookies de session et les jetons y transitent en lisible,
// donc sur un canal qu'un tiers peut lire ET modifier. Une allowlist qui
// l'accepte lui permet de rejouer une requête cross-site authentifiée hors de
// tout contrôle. Hors développement, `https` n'est donc pas une préférence
// mais une EXIGENCE, appliquée SANS échappatoire : voir `resolveTrustedOrigins`.

/** Origines de développement uniquement (jamais en production). */
const DEV_ONLY_TRUSTED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://192.168.1.*",
  "http://192.168.0.*",
  "https://*.ngrok-free.app",
  "https://*.loca.lt",
  "https://*.vercel.app",
];

/**
 * Origines de production connues, exactes (aucun joker) et en HTTPS.
 *
 * #283 — le SCHÉMA n'est pas négociable : une entrée `http://` a été retirée
 * de cette liste. Même règle appliquée à toutes les autres origines en
 * production (`resolveTrustedOrigins`), celle-ci n'en est que le cas nominal.
 * #305 — domaine lu depuis NEXT_PUBLIC_APP_URL, plus de valeur en dur.
 */
function getKnownProductionOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl && appUrl.startsWith("https://")) return [appUrl];
  // Fallback si la variable est absente (dev/tests)
  return ["https://attestations.fermestandre.com"];
}

export type TrustedOriginsEnv = {
  NODE_ENV?: string;
  APP_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_TRUST_ORIGINS_ALLOW_WILDCARDS?: string;
};

/**
 * Normalise une origine : trimée, sans barre oblique finale.
 * Renvoie `null` si la valeur n'est PAS une origine absolue valide
 * (joker, URL relative, schéma non http(s), chaîne vide).
 */
export function parseTrustedOrigin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.includes("*")) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.host) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function splitOriginList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Variante tolérante aux jokers, réservée au développement (ou à l'échappatoire
 * explicite `BETTER_AUTH_TRUST_ORIGINS_ALLOW_WILDCARDS`). Le `*` n'est
 * accepté que dans l'hôte, jamais dans le schéma ni le chemin.
 */
function parseConfiguredOrigin(
  raw: unknown,
  allowWildcard: boolean,
): string | null {
  if (allowWildcard && typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed && !/\s/.test(trimmed)) {
      if (/^https?:\/\/[a-z0-9.-]*\*[a-z0-9.-]*(:\d+)?$/i.test(trimmed)) {
        return trimmed;
      }
    }
  }
  return parseTrustedOrigin(raw);
}

/**
 * Une origine `http://` est EN CLAIR : le canal est lisible et modifiable par
 * un tiers, ce qui suffit à rejouer une requête cross-site authentifiée.
 * #283 — hors développement, le schéma `https` est une EXIGENCE.
 *
 * Volontairement fondé sur le préfixe et non sur `new URL()` : les origines à
 * joker (échappatoire `BETTER_AUTH_TRUST_ORIGINS_ALLOW_WILDCARDS`) ne sont pas
 * des URL analysables, et doivent donc subir exactement le même refus.
 */
function isCleartextOrigin(origin: string): boolean {
  return origin.toLowerCase().startsWith("http://");
}

/**
 * Construit la liste `trustedOrigins` de Better Auth.
 *
 * @param env     Environnement (injectable pour les tests)
 * @returns liste dédupliquée, sans origine invalide
 * @throws  si une origine en HTTP est configurée en production (voir #283) :
 *          le défaut est BLOQUANT et remonte au chargement du module, donc au
 *          démarrage, plutôt qu'un avertissement ignoré.
 */
export function resolveTrustedOrigins(
  env: TrustedOriginsEnv = process.env as TrustedOriginsEnv,
): string[] {
  const isProduction = env.NODE_ENV === "production";
  const allowWildcards =
    !isProduction || env.BETTER_AUTH_TRUST_ORIGINS_ALLOW_WILDCARDS === "true";

  const configured = [
    env.APP_URL,
    env.BETTER_AUTH_URL,
    env.NEXT_PUBLIC_APP_URL,
    ...splitOriginList(env.BETTER_AUTH_TRUSTED_ORIGINS),
    ...splitOriginList(env.AUTH_TRUSTED_ORIGINS),
    // En production : uniquement les domaines exacts du projet. Les jokers
    // (localhost, LAN, tunnels) sont PurVU de la configuration.
    ...(isProduction ? getKnownProductionOrigins() : DEV_ONLY_TRUSTED_ORIGINS),
  ];

  const origins: string[] = [];
  const cleartext: string[] = [];
  for (const candidate of configured) {
    const origin = parseConfiguredOrigin(candidate, allowWildcards);
    if (!origin) {
      // Rejet explicite et bruyant : une origine ignorée en production
      // implique un callback OAuth / une URL de retour refusée.
      console.warn(
        `[AUTH] Origine de confiance REJETÉE (non absolue ou joker) : ${String(candidate)}`,
      );
      continue;
    }
    // #283 — HTTPS obligatoire en production, AVANT l'ajout à l'allowlist :
    // l'origine en clair n'est jamais « tolérée puis signalée », elle n'existe
    // pas pour Better Auth.
    if (isProduction && isCleartextOrigin(origin)) {
      cleartext.push(origin);
      continue;
    }
    if (!origins.includes(origin)) origins.push(origin);
  }

  // Rejet BRUYANT et BLOQUANT. Ignorer l'origine en clair laisserait
  // Better Auth démarrer avec une allowlist incomplète : le symptôme
  // (callback refusé, 403 opaque en production) arriverait BIEN plus tard et
  // sans cause visible. `resolveTrustedOrigins` est appelé au chargement de ce
  // module, donc avant tout traitement de requête : on échoue au démarrage, en
  // nommant les origines fautives et la variable à corriger.
  if (cleartext.length > 0) {
    const message =
      `[AUTH] Origine(s) de confiance en HTTP REFUSÉE(S) en production : ${cleartext.join(", ")}. ` +
      "Le schéma https:// est obligatoire hors développement : corrigez APP_URL / " +
      "NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL / BETTER_AUTH_TRUSTED_ORIGINS / AUTH_TRUSTED_ORIGINS.";
    console.error(message);
    throw new Error(message);
  }

  if (origins.length === 0) {
    console.error(
      "[AUTH] Aucune origine de confiance valide. Définissez APP_URL / BETTER_AUTH_TRUSTED_ORIGINS.",
    );
  }

  return origins;
}

/**
 * #304 — Garde-fou Better Auth : refuse la CRÉATION d'une session pour un
 * compte bloqué / suspendu et révoque les sessions déjà ouvertes.
 * Couvre la connexion (mot de passe, OTP, 2FA, providers) et la rotation de
 * session. Exposé pour être testé directement.
 */
export async function guardSessionCreation(
  session: { userId: string },
): Promise<boolean | void> {
  if (typeof session?.userId !== "string" || !session.userId) return;

  const decision = await enforceAccountStatus(session.userId);
  if (!decision.allowed) {
    throw new APIError("FORBIDDEN", {
      message: accountBlockMessage(decision),
      code: "ACCOUNT_BLOCKED",
    });
  }
}

/**
 * Instance d'authentification Better Auth
 */
export const auth = betterAuth({
  database: prismaAdapter(rawPrisma, {
    provider: "postgresql",
  }),
  secret: authSecret || "dev-fallback-secret-do-not-use-in-prod",
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000"),
  // #283 — allowlist exacte en production, jokers réservés au développement.
  trustedOrigins: resolveTrustedOrigins(),
  user: {
    // No additionalFields - Better Auth sign-up endpoint doesn't handle them properly
    // All additional fields (phone, birthPlace, address, birthDate, formationId)
    // are updated after sign-up via /api/user/after-signup
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: process.env.NODE_ENV === "production",
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          console.log(`[AUTH] Sanitizing user creation for: ${user.email}`);
          // Prisma attend DateTime? ou null, mais Better Auth envoie boolean.
          // Conversion centralisée (voir lib/email-verified.ts).
          const sanitizedUser = normalizeEmailVerified({ ...user });
          return { data: sanitizedUser as any };
        },
        after: async (user) => {
          console.log(`[AUTH] User created successfully: ${user.email}`);
        },
      },
      update: {
        before: async (user) => {
          // Même logique centralisée pour l'update.
          const normalized = normalizeEmailVerified({ ...(user as any) });
          (user as any).emailVerified = (normalized as any).emailVerified;
          return { data: user as any };
        },
      },
    },
    // #304 — Statut de compte appliqué à la CONNEXION : aucune session n'est
    // créée pour un compte BLOCKED / SUSPENDED (mot de passe, OTP, 2FA,
    // inscription, providers). Le plugin admin de Better Auth applique la
    // même règle sur son champ `banned` ; celui-ci est lu en complément.
    session: {
      create: {
        before: guardSessionCreation,
      },
    },
  },
  hooks: {
    // #304 — Statut de compte appliqué au RAFRAÎCHISSEMENT et à la lecture de
    // session. Dans Better Auth 1.7 le refresh est effectué par `/get-session`
    // (mise à jour de la ligne `session`) : on bloque donc ce point d'entrée.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/get-session") return;

      const session = await getSessionFromCtx(ctx, { disableRefresh: true });
      const userId = session?.user?.id;
      if (typeof userId !== "string" || !userId) return;

      const decision = await enforceAccountStatus(userId);
      if (!decision.allowed) {
        throw new APIError("FORBIDDEN", {
          message: accountBlockMessage(decision),
          code: "ACCOUNT_BLOCKED",
        });
      }
    }),
  },
  plugins: [
    nextCookies(),
    admin({
      adminUserIds: [
        ...(process.env.ADMIN_USER_IDS
          ? process.env.ADMIN_USER_IDS.split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : []),
      ],
    }),
    twoFactor({
      issuer: "Ferme Agro-Piscicole Cité St André",
      totpOptions: {
        digits: 6,
        period: 30,
      },
      otpOptions: {
        sendOTP: async ({ user, otp }) => {
          const { emailService } = await import("@/lib/email");
          await emailService.sendTwoFactorOTP(
            user.email,
            user.name || "Administrateur",
            otp,
          );
        },
        period: 5,
        allowedAttempts: 5,
        storeOTP: process.env.NODE_ENV === "production" ? "encrypted" : "plain",
      },
      backupCodeOptions: {
        amount: 10,
        length: 10,
        storeBackupCodes:
          process.env.NODE_ENV === "production" ? "encrypted" : "plain",
      },
      twoFactorCookieMaxAge: 600,
      trustDeviceMaxAge: 30 * 24 * 60 * 60,
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10, // 10 minutes
      allowedAttempts: 5,
      resendStrategy: "rotate",
      // L'inscription e-mail/mot de passe déclenche l'envoi d'un OTP
      // (type "email-verification") au lieu du lien de vérification par défaut.
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        const { emailService } = await import("@/lib/email");

        if (type === "email-verification") {
          await emailService.sendVerificationOTP(
            email,
            email.split("@")[0],
            otp,
          );
        } else if (type === "sign-in") {
          await emailService.sendFsaLoginOTP(
            email,
            email.split("@")[0],
            otp,
          );
        } else if (type === "forget-password") {
          await emailService.sendPasswordResetOTP(
            email,
            email.split("@")[0],
            otp,
          );
        } else if (type === "change-email") {
          // Flux de changement d'email non pris en charge pour l'instant
          console.warn(
            `[AUTH] OTP "change-email" ignoré (non pris en charge) pour ${email}`,
          );
        }
      },
    }),
  ],
  advanced: {
    cookiePrefix: "better-auth",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24 * 1, // 1 jour
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
});

/**
 * Helper de compatibilité (async)
 */
export const getAuth = async () => auth;

/**
 * ✅ FIX: Helper to safely extract role from session user with proper typing
 */
function getUserRole(user: { role?: unknown }): string | undefined {
  if (typeof user.role === "string") {
    return user.role;
  }
  return undefined;
}

/**
 * #304 — Un compte BLOCKED / SUSPENDED perd immédiatement l'accès :
 * les sessions vivantes sont révoquées et `null` est renvoyé.
 * Point d'application unique, situé ici pour que TOUTES les routes
 * s'appuyant sur `getCurrentUser` / `getAdminUser` (donc aussi
 * `requireUser` / `requireAdmin` de `@/lib/api-auth`) soient bloquées.
 */
async function isSessionUserAllowed(userId: string): Promise<boolean> {
  if (!userId) return false;

  const decision: AccountAccessDecision = await enforceAccountStatus(userId);
  if (decision.allowed) return true;

  console.warn(accountBlockLogMessage(decision));
  return false;
}

/**
 * 🔒 Récupère l'admin authentifié en un seul appel atomique
 * Retourne null si non authentifié, non admin, ou compte bloqué/suspendu
 *
 * @param request - La requête HTTP (obligatoire pour les routes API)
 * @returns L'utilisateur admin ou null
 */
export async function getAdminUser(
  request: Request,
): Promise<SessionUser | null> {
  try {
    // 1. Essai avec Better Auth
    const session = await auth.api.getSession({ headers: request.headers });

    if (session?.user) {
      const userId = session.user.id as string;
      // #304 — Un compte bloqué/suspendu n'est plus administrateur : la
      // session estinvalidée et l'accès refusé.
      if (!(await isSessionUserAllowed(userId))) return null;

      const role = getUserRole(session.user);
      if (role?.toLowerCase() !== "admin") return null;
      return {
        id: session.user.id as string,
        email: session.user.email as string,
        name: (session.user.name as string | null | undefined) || null,
        role: "admin",
        emailVerified: isEmailVerified(session.user.emailVerified),
      };
    }

    return null;
  } catch (error: unknown) {
    console.error("[AUTH ERROR] getAdminUser:", error);
    return null;
  }
}

/**
 * Vérifie si l'utilisateur est un administrateur (Hybride)
 * @deprecated Utilisez getAdminUser() pour obtenir l'utilisateur ET vérifier le rôle en un seul appel
 */
export async function isAdminAuthenticated(request: Request): Promise<boolean> {
  const adminUser = await getAdminUser(request);
  return adminUser !== null;
}

/**
 * Récupère l'utilisateur actuellement connecté (Hybride)
 */
export async function getCurrentUser(
  request?: Request,
): Promise<
  | SessionUser
  | { id: string; email: string; name: string | null; role: string }
  | null
> {
  try {
    // 1. Essai avec Better Auth
    const session = request
      ? await auth.api.getSession({ headers: request.headers })
      : await auth.api.getSession({ headers: await headers() });

    if (session?.user) {
      // #304 — Statut de compte : un compte bloqué/suspendu ne peut plus agir,
      // même si sa session est encore valide côté cookie.
      if (!(await isSessionUserAllowed(session.user.id as string))) return null;

      const role = getUserRole(session.user) ?? "user";
      return {
        id: session.user.id as string,
        email: session.user.email as string,
        name: session.user.name as string | null | undefined,
        role,
        emailVerified: isEmailVerified(session.user.emailVerified),
      } as SessionUser;
    }

    return null;
  } catch (error: any) {
    console.error("[AUTH ERROR] getCurrentUser:", error);
    // On log l'erreur spécifique pour diagnostiquer "Failed to get session"
    if (error.message?.includes("session")) {
      console.error("DEBUG SESSION DATA:", {
        headers: request?.headers?.get("cookie") ? "PRESENT" : "MISSING",
        env: process.env.NODE_ENV,
      });
    }
    return null;
  }
}
