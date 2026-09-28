/**
 * Sémantique de cycle de vie NON destructif des attestations (#299 / #301).
 *
 * Ce module est PUR : aucun accès base, aucun secret, aucune écriture. Il
 * décide, à partir de l'état courant d'une attestation, ce qu'une action
 * d'administration peut faire — et, surtout, ce qu'elle ne peut PAS faire :
 *
 *  - SUPPRESSION PHYSIQUE : impossible. Une attestation émise porte un code
 *    imprimé, un PDF, un hash et un sceau ; la retirer, c'est rendre un document
 *    vérifié caduc en silence. La seule voie est la suppression LOGIQUE
 *    (`deletedAt` + motif + auteur), doublée d'une révocation PUBLIQUE
 *    horodatée si l'attestation était VALIDATED ou CLAIMED.
 *  - RÉVOCATION : `status = REVOKED` + date + auteur + motif. Elle n'est jamais
 *    déguisée en `REJECTED` et ne réécrit ni le sceau ni la preuve PDF.
 *  - RÉTROGRADATION : la session probante est ARCHIVÉE (statut `ARCHIVED`,
 *    horodatage, motif) — jamais supprimée ; les réponses restent lisibles et le
 *    sceau n'est pas invalidé. Le journal d'audit porte le détail de l'action.
 *
 * Toute action exige un MOTIF : `parseLifecycleReason` le refuse en dessous de
 * `LIFECYCLE_REASON_MIN_LENGTH` caractères, sans quoi aucune écriture n'a lieu.
 */

/** Code d'erreur métier : suppression physique demandée et refusée. */
export const ATTESTATION_PHYSICAL_DELETE_REFUSED = "ATTESTATION_PHYSICAL_DELETE_REFUSED";

/** Message de refus, sans valeur sensible : aucun code n'y est rejoué. */
export const PHYSICAL_DELETE_REFUSED_MESSAGE =
  "La suppression physique d'une attestation est interdite : une attestation émise est un document " +
  "probant (PDF, hash, sceau, audit). Utilisez la suppression logique avec motif, qui bascule " +
  "l'attestation en révocation publique si elle était valide ou récupérée.";

/** Code d'erreur métier : l'attestation est déjà supprimée logiquement. */
export const ATTESTATION_ALREADY_SOFT_DELETED = "ATTESTATION_ALREADY_SOFT_DELETED";

/** Longueur minimale du motif d'une action de cycle de vie. */
export const LIFECYCLE_REASON_MIN_LENGTH = 5;

/** Statut de session appliqué lors d'une rétrogradation (jamais un DELETE). */
export const ARCHIVED_SESSION_STATUS = "ARCHIVED";

/** Statut d'attestation d'une révocation publique. */
export const REVOKED_STATUS = "REVOKED";

/**
 * Actions d'audit du cycle de vie. Les valeurs sont celles de `lib/audit.ts`
 * (hors périmètre d'édition ici) : `ATTESTATION_DELETED` est désormais un
 * SOFT-DELETE, dont la nature est portée par `newValue.softDelete`.
 */
export const LIFECYCLE_AUDIT_ACTIONS = {
  SOFT_DELETE: "ATTESTATION_DELETED",
  REVOKE: "ATTESTATION_REVOKED",
  RETROGRADE: "USER_RETROGRADED",
} as const;

export type LifecycleReason = { ok: true; reason: string } | { ok: false; message: string };

export interface AttestationLifecycleRecord {
  id: string;
  code: string;
  status: string;
  userId?: string | null;
  sessionId?: string | null;
  formationId?: string | null;
  deletedAt?: Date | null;
  revokedAt?: Date | null;
}

export interface LifecycleActor {
  reason: string;
  actorId: string | null;
  now?: Date;
}

export interface SoftDeletePlan {
  /** Données d'écriture : jamais de champ probant (PDF, hash, sceau, code). */
  data: Record<string, unknown>;
  /** Vrai si l'attestation était émise (VALIDATED/CLAIMED) et doit être révoquée. */
  revoked: boolean;
  previousStatus: string;
}

export interface RetrogradePlan {
  attestation: Record<string, unknown>;
  sessionArchive: { where: Record<string, unknown>; data: Record<string, unknown> } | null;
}

/** Normalise et valide un motif d'action de cycle de vie. */
export function parseLifecycleReason(raw: unknown): LifecycleReason {
  if (typeof raw !== "string") {
    return { ok: false, message: `Un motif de minimum ${LIFECYCLE_REASON_MIN_LENGTH} caractères est obligatoire.` };
  }
  const reason = raw.trim();
  if (reason.length < LIFECYCLE_REASON_MIN_LENGTH) {
    return { ok: false, message: `Un motif de minimum ${LIFECYCLE_REASON_MIN_LENGTH} caractères est obligatoire.` };
  }
  return { ok: true, reason };
}

/** Une attestation est « émise » une fois validée ou récupérée par son titulaire. */
export function isIssued(status: string): boolean {
  return status === "VALIDATED" || status === "CLAIMED";
}

/**
 * Plan de suppression LOGIQUE. Le PDF, le hash, le sceau, le code et le statut
 * d'origine sont préservés : seuls les champs de cycle de vie sont écrits.
 */
export function softDeletePlan(
  attestation: AttestationLifecycleRecord,
  { reason, actorId, now = new Date() }: LifecycleActor,
): SoftDeletePlan {
  const revoked = isIssued(attestation.status);
  const data: Record<string, unknown> = {
    deletedAt: now,
    deletedById: actorId,
    deleteReason: reason,
  };
  if (revoked) {
    // Révocation PUBLIQUE horodatée : le document reste consultable et
    // vérifiable, mais il n'est plus opposable.
    data.status = REVOKED_STATUS;
    data.revokedAt = now;
    data.revokedById = actorId;
    data.revokeReason = reason;
  }
  return { data, revoked, previousStatus: attestation.status };
}

/** Plan de révocation : statut daté, sceau et preuve PDF intacts. */
export function revokePlan(
  attestation: AttestationLifecycleRecord,
  { reason, actorId, now = new Date() }: LifecycleActor,
): { data: Record<string, unknown> } {
  void attestation;
  return {
    data: {
      status: REVOKED_STATUS,
      revokedAt: now,
      revokedById: actorId,
      revokeReason: reason,
    },
  };
}

/** Filtre d'archivage des sessions probantes liées à l'attestation. */
export function sessionArchiveWhere(attestation: AttestationLifecycleRecord): Record<string, unknown> | null {
  const branches: Record<string, unknown>[] = [];
  if (attestation.sessionId) branches.push({ id: attestation.sessionId });
  if (attestation.userId && attestation.formationId) {
    branches.push({ userId: attestation.userId, exam: { formationId: attestation.formationId } });
  }
  if (branches.length === 0) return null;
  return branches.length === 1 ? branches[0] : { OR: branches };
}

/**
 * Plan de rétrogradation : la session est ARCHIVÉE, pas supprimée, et le
 * sceau n'est pas réécrit (une altération du sceau ferait échouer la
 * vérification publique d'un document pourtant authentique).
 */
export function retrogradePlan(
  attestation: AttestationLifecycleRecord,
  { reason, actorId, now = new Date() }: LifecycleActor,
): RetrogradePlan {
  const where = sessionArchiveWhere(attestation);
  return {
    attestation: {
      status: "PENDING",
      certificationScore: 0,
      stageScore: 0,
      certificationHours: 0,
      stageHours: 0,
      retrogradedAt: now,
      retrogradedById: actorId,
      retrogradeReason: reason,
    },
    sessionArchive: where
      ? {
          where,
          data: {
            status: ARCHIVED_SESSION_STATUS,
            archivedAt: now,
            archivedById: actorId,
            archiveReason: reason,
          },
        }
      : null,
  };
}

/** Une session est-elle archivée (et donc encore lisible) ? */
export function isArchivedSession(session: { status: string; archivedAt?: Date | null }): boolean {
  return session.status === ARCHIVED_SESSION_STATUS || Boolean(session.archivedAt);
}

/**
 * Qui notifier ? Un titulaire connu, sinon — cas des ~40 historiques anonymes —
 * les administrateurs : une révocation ou une rétrogradation ne doit jamais
 * être silencieuse, y compris pour une ligne sans compte candidat.
 */
export function notificationAudience(
  attestation: AttestationLifecycleRecord,
): { kind: "user"; userId: string } | { kind: "admins"; reason: "ANONYMOUS" } {
  if (attestation.userId) return { kind: "user", userId: attestation.userId };
  return { kind: "admins", reason: "ANONYMOUS" };
}
