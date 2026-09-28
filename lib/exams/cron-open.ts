import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

/**
 * Ouverture automatique des examens planifiés (cron interne).
 *
 * Règles (cf. docs/superpowers/specs/2026-09-25-exam-scheduling-design.md) :
 * - un examen `SCHEDULED` bascule vers `PUBLISHED` quand `scheduledAt <= now` ;
 * - l'opération est IDEMPOTENTE : un second passage ne touche plus aucune ligne
 *   (le `updateMany` est conditionnel sur le statut ET sur la date) ;
 * - chaque bascule est journalisée dans `AuditLog` ;
 * - le cache des examens est invalidé après coup ;
 * - la réponse n'expose AUCUNE donnée publique d'examen (ni titre, ni barème,
 *   ni description, ni questions) : uniquement un compteur et des ids.
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
 * une route morte (et visible dans les logs) qu'un endpoint d'ouverture
 * scopé par une valeur par défaut ou une chaîne vide.
 */
export function verifyCronSecret(authorizationHeader: string | null | undefined): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.trim().length < MIN_CRON_SECRET_LENGTH) {
    console.error(
      "[EXAM CRON] CRON_SECRET absent ou trop court — POST /api/internal/exams/open refusé",
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
 * journalisation est sautée — l'ouverture ne doit pas dépendre de l'audit).
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

export type OpenDueExamsResult = {
  /** Nombre d'examens réellement basculés lors de cet appel. */
  opened: number;
  /** Ids des examens basculés (opaque, aucune donnée publique). */
  ids: string[];
  /** Examen à l'instant de l'appel. */
  now: string;
};

/**
 * Bascule, une seule fois, les examens `SCHEDULED` dont l'heure est atteinte.
 *
 * Idempotent : appelé deux fois, le second appel renvoie `opened: 0`.
 */
export async function openDueScheduledExams(
  now: Date = new Date(),
): Promise<OpenDueExamsResult> {
  const due = await prisma.exam.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, status: true, scheduledAt: true },
  });

  if (due.length === 0) {
    return { opened: 0, ids: [], now: now.toISOString() };
  }

  // Conditionnel : si une requête concurrente (ou un appel précédent du cron) a
  // déjà basculé ces lignes, `count` vaut 0 et rien n'est journalisé deux fois.
  const { count } = await prisma.exam.updateMany({
    where: {
      id: { in: due.map((exam) => exam.id) },
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    data: { status: "PUBLISHED" },
  });

  if (count === 0) {
    return { opened: 0, ids: [], now: now.toISOString() };
  }

  const actorId = await resolveAuditActorId();
  if (actorId) {
    await Promise.all(
      due.map((exam) =>
        createAuditLog({
          userId: actorId,
          action: "EXAM_AUTO_OPENED",
          resource: "EXAM",
          resourceId: exam.id,
          oldValue: { status: exam.status, scheduledAt: exam.scheduledAt },
          newValue: { status: "PUBLISHED", openedBy: "cron", openedAt: now.toISOString() },
        }),
      ),
    );
  } else {
    console.warn(
      `[EXAM CRON] ${count} examen(s) ouvert(s) sans journal d'audit (aucun compte admin / CRON_AUDIT_USER_ID)`,
    );
  }

  console.log(`[EXAM CRON] ${count} examen(s) SCHEDULED -> PUBLISHED`);
  return { opened: count, ids: due.map((exam) => exam.id), now: now.toISOString() };
}
