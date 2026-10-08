import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { isOfficialStoredObject } from "@/lib/storage/registry";

/**
 * Purge de rétention RGPD (#153).
 *
 * `retentionUntil` est posée à l'upload (`app/api/upload/route.ts`, 365 j)
 * mais n'était jamais appliquée : ce module supprime, une fois l'échéance
 * atteinte (`retentionUntil < now`), les objets stockés échus ET les lignes
 * `AuditLog` anciennes, et journalise chaque passage effectif.
 *
 * Règles :
 * - IDEMPOTENT : un second passage ne touche plus aucune ligne (les requêtes
 *   sont conditionnelles sur l'échéance ; la ligne d'audit `RETENTION_PURGED`
 *   n'est écrite que si au moins une ligne a été purgée) ;
 * - les objets officiels (`purpose = attestation` ou préfixe `attestations/`,
 *   pièces probantes #260) ne sont JAMAIS purgés, même échus ;
 * - octets d'abord, ligne ensuite : si la suppression côté stockage échoue,
 *   la ligne est conservée pour réessai au prochain passage ;
 * - la réponse n'expose aucune donnée personnelle : compteurs + clés opaques.
 *
 * Protection : la route HTTP (`app/api/internal/retention/purge/route.ts`)
 * exige `Authorization: Bearer <CRON_SECRET>` via `verifyCronSecret`
 * (implémentation unique, réexportée depuis `lib/exams/cron-open` comme les
 * autres crons du dépôt).
 */

// Source unique de la protection cron — même garde que les autres crons.
export { MIN_CRON_SECRET_LENGTH, verifyCronSecret } from "@/lib/exams/cron-open";

/** Conservation par défaut des objets uploadés (posée à l'upload). */
export const DEFAULT_RETENTION_DAYS = 365;

/**
 * Conservation du journal d'audit, pilotée par `timestamp` (`AuditLog` ne
 * porte pas de `retentionUntil`). Même fenêtre que les objets : au-delà,
 * les traces sont purgées avec le reste.
 */
export const AUDIT_LOG_RETENTION_DAYS = 365;

export type PurgeRetentionResult = {
  /** Lignes `StoredObject` supprimées (octets + registre). */
  storedObjects: number;
  /** Lignes `AuditLog` supprimées. */
  auditLogs: number;
  /** Clés des objets purgés (opaques, aucune donnée personnelle). */
  keys: string[];
  /** Instant de référence de l'appel. */
  now: string;
};

/**
 * Résout l'auteur des entrées d'audit : le cron n'a pas de session
 * utilisateur. `CRON_AUDIT_USER_ID` prime ; sinon le premier compte admin.
 * Retourne `null` si aucun compte n'est disponible (la purge reste
 * effectuée, seule la journalisation est sautée).
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
    console.error("[RETENTION] résolution de l'auteur d'audit impossible:", error);
    return null;
  }
}

/**
 * Purge, une seule fois, les données dont la conservation est échue.
 *
 * Idempotent : appelé deux fois, le second appel renvoie des compteurs à 0
 * et n'écrit aucune ligne d'audit.
 */
export async function purgeExpiredRetention(
  now: Date = new Date(),
  options: { auditLogRetentionDays?: number } = {},
): Promise<PurgeRetentionResult> {
  const auditDays = options.auditLogRetentionDays ?? AUDIT_LOG_RETENTION_DAYS;
  const auditCutoff = new Date(now.getTime() - auditDays * 24 * 60 * 60 * 1000);

  // 1. Objets stockés échus (`retentionUntil < now`, NULL = conservation
  //    indéfinie, jamais matchée par `<`). Les pièces officielles sont
  //    exclues ici même si leur échéance est atteinte.
  const expired = await prisma.storedObject.findMany({
    where: { retentionUntil: { lt: now } },
    select: { id: true, key: true, purpose: true },
  });
  const purgable = expired.filter((object) => !isOfficialStoredObject(object));

  const deletedKeys: string[] = [];
  if (purgable.length > 0) {
    const storage = getStorage();
    const deletedIds: string[] = [];
    for (const object of purgable) {
      try {
        await storage.delete(object.key);
      } catch (error) {
        // Octets injoignables : la ligne est conservée pour réessai au
        // prochain passage (jamais de ligne sans octets supprimés, jamais
        // d'octets orphelins sans ligne).
        console.error(
          `[RETENTION] suppression stockage impossible (${object.key}) — ligne conservée:`,
          error,
        );
        continue;
      }
      deletedIds.push(object.id);
      deletedKeys.push(object.key);
    }
    // Conditionnel sur les ids effectivement supprimés côté stockage.
    if (deletedIds.length > 0) {
      await prisma.storedObject.deleteMany({ where: { id: { in: deletedIds } } });
    }
  }

  // 2. Journal d'audit échu (`timestamp` antérieur à la fenêtre).
  const { count: purgedAuditLogs } = await prisma.auditLog.deleteMany({
    where: { timestamp: { lt: auditCutoff } },
  });

  const result: PurgeRetentionResult = {
    storedObjects: deletedKeys.length,
    auditLogs: purgedAuditLogs,
    keys: deletedKeys,
    now: now.toISOString(),
  };

  // 3. Une seule ligne d'audit par passage EFFECTIF (zéro purge = silence,
  //    donc un second passage n'écrit rien : idempotence observable).
  if (result.storedObjects > 0 || result.auditLogs > 0) {
    const actorId = await resolveAuditActorId();
    if (actorId) {
      await createAuditLog({
        userId: actorId,
        action: "RETENTION_PURGED",
        resource: "RETENTION",
        resourceId: `purge-${now.toISOString().slice(0, 10)}`,
        newValue: {
          storedObjects: result.storedObjects,
          auditLogs: result.auditLogs,
          purgedBy: "cron",
          purgedAt: result.now,
        },
      });
    } else {
      console.warn(
        `[RETENTION] purge sans journal d'audit (aucun compte admin / CRON_AUDIT_USER_ID)`,
      );
    }
    console.log(
      `[RETENTION] ${result.storedObjects} objet(s) et ${result.auditLogs} log(s) d'audit purgé(s)`,
    );
  }

  return result;
}
