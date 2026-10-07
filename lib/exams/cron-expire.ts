import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

/**
 * Expiration des sessions d'examen (cron interne).
 *
 * Règles (#318) :
 * - une session `IN_PROGRESS` dont `expiresAt <= now` bascule vers `EXPIRED` ;
 * - l'opération est IDEMPOTENTE : un second passage ne touche plus aucune
 *   ligne (le `updateMany` est conditionnel sur le statut ET sur la date) ;
 * - chaque bascule est journalisée dans `AuditLog` ;
 * - les sessions sans `expiresAt` (héritées) ne sont jamais expirées ;
 * - la réponse n'expose AUCUNE donnée publique d'examen : uniquement un
 *   compteur et des ids.
 *
 * Aucune mutation n'est possible sans `CRON_SECRET` : la comparaison est faite
 * en temps constant sur des empreintes SHA-256 (longueur fixe, donc aucune
 * fuite par timing sur la longueur du secret).
 */

/** Longueur minimale du secret cron, refusée en configuration. */
export const MIN_CRON_SECRET_LENGTH = 16;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Comparaison à temps constant de deux chaînes (via empreintes de taille fixe). */
export function safeEqual(a: string, b: string): boolean {
  const ha = sha256(a);
  const hb = sha256(b);
  return timingSafeEqual(ha, hb);
}

/**
 * Vérifie l'en-tête `Authorization: Bearer <CRON_SECRET>`.
 *
 * Retourne `false` si le secret n'est pas configuré côté serveur : mieux vaut
 * une route morte (et visible dans les logs) qu'un endpoint d'expiration
 * scopé par une valeur par défaut ou une chaîne vide.
 */
export function verifyCronSecret(authorizationHeader: string | null | undefined): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.trim().length < MIN_CRON_SECRET_LENGTH) {
    console.error(
      "[EXAM CRON] CRON_SECRET absent ou trop court — POST /api/internal/exams/expire refusé",
    );
    return false;
  }
  if (!authorizationHeader) return false;

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match) return false;

  const provided = match[1].trim();
  if (!provided) return false;

  return safeEqual(provided, expected.trim());
}

/**
 * Résout l'auteur des entrées d'audit : le cron n'a pas de session utilisateur.
 * `CRON_AUDIT_USER_ID` prime ; sinon le premier compte admin. Retourne `null`
 * si aucun compte n'est disponible (les basculements restent effectués, seule la
 * journalisation est sautée — l'expiration ne doit pas dépendre de l'audit).
 */
async function resolveAuditActorId(): Promise<string | null> {
  const configured = process.env.CRON_AUDIT_USER_ID?.trim();
  if (configured) return configured;
  try {
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return admin?.id ?? null;
  } catch (error) {
    console.error("[EXAM CRON] résolution de l'auteur d'audit impossible:", error);
    return null;
  }
}

export type ExpireDueSessionsResult = {
  /** Nombre de sessions réellement basculées lors de cet appel. */
  expired: number;
  /** Ids des sessions basculées (opaque, aucune donnée publique). */
  ids: string[];
  /** Instant de référence de l'appel. */
  now: string;
};

/**
 * Bascule, une seule fois, les sessions `IN_PROGRESS` dont l'échéance est atteinte.
 *
 * Idempotent : appelé deux fois, le second appel renvoie `expired: 0`.
 */
export async function expireDueSessions(
  now: Date = new Date(),
): Promise<ExpireDueSessionsResult> {
  const due = await prisma.examSession.findMany({
    where: { status: "IN_PROGRESS", expiresAt: { lte: now } },
    select: { id: true, status: true, expiresAt: true },
  });

  if (due.length === 0) {
    return { expired: 0, ids: [], now: now.toISOString() };
  }

  // Conditionnel : si une requête concurrente (ou un appel précédent du cron) a
  // déjà basculé ces lignes, `count` vaut 0 et rien n'est journalisé deux fois.
  const { count } = await prisma.examSession.updateMany({
    where: {
      id: { in: due.map((s) => s.id) },
      status: "IN_PROGRESS",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  if (count === 0) {
    return { expired: 0, ids: [], now: now.toISOString() };
  }

  const actorId = await resolveAuditActorId();
  if (actorId) {
    await Promise.all(
      due.map((s) =>
        createAuditLog({
          userId: actorId,
          action: "EXAM_SESSION_EXPIRED",
          resource: "EXAM_SESSION",
          resourceId: s.id,
          oldValue: { status: s.status, expiresAt: s.expiresAt },
          newValue: { status: "EXPIRED", expiredBy: "cron", expiredAt: now.toISOString() },
        }),
      ),
    );
  } else {
    console.warn(
      `[EXAM CRON] ${count} session(s) expirée(s) sans journal d'audit (aucun compte admin / CRON_AUDIT_USER_ID)`,
    );
  }

  console.log(`[EXAM CRON] ${count} session(s) IN_PROGRESS -> EXPIRED`);
  return { expired: count, ids: due.map((s) => s.id), now: now.toISOString() };
}
