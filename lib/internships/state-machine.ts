/**
 * #267 — Machine à états des demandes de stage (`InternshipStatus`).
 *
 * Source de vérité unique des transitions autorisées côté admin. Toute mutation
 * de `InternshipRequest.status` passe par `validateInternshipStatusTransition` :
 * une valeur hors enum ou une transition hors matrice est refusée en 400
 * AVANT toute écriture, pour ne jamais laisser une demande dans un statut
 * incohérent (ex. une demande REJECTED ré-acceptée sans reprise en examen, ou
 * une demande ARCHIVED remise en flux).
 *
 * Règles :
 * - le même statut vers le même statut est toujours autorisé (no-op) ;
 * - ARCHIVED est TERMINAL : la réouverture passe par une nouvelle demande
 *   (cohérent avec `lib/exams/transitions.ts` pour les examens) ;
 * - toute réouverture d'une décision (REJECTED) ou d'un archivage doit repasser
 *   par REVIEWING : la réexpertise est explicite et auditable.
 */

/** Statuts admin possibles (miroir de l'enum Prisma `InternshipStatus`). */
export const INTERNSHIP_STATUSES = [
  "PENDING",
  "REVIEWING",
  "ACCEPTED",
  "REJECTED",
  "ARCHIVED",
] as const;

export type InternshipStatusValue = (typeof INTERNSHIP_STATUSES)[number];

/** Matrice des transitions autorisées (hors transition vers le même statut). */
export const INTERNSHIP_STATUS_TRANSITIONS: Readonly<
  Record<InternshipStatusValue, readonly InternshipStatusValue[]>
> = {
  // Nouvelle demande : examen, décision ou archivage direct.
  PENDING: ["REVIEWING", "ACCEPTED", "REJECTED", "ARCHIVED"],
  // En cours d'examen : décision, retour en attente ou archivage.
  REVIEWING: ["PENDING", "ACCEPTED", "REJECTED", "ARCHIVED"],
  // Décision favorable : archivage (délivrance d'attestation), retour en
  // examen (dossier incomplet) ou annulation de la décision.
  ACCEPTED: ["REVIEWING", "REJECTED", "ARCHIVED"],
  // Décision défavorable : réexamen explicite (REVIEWING) ou archivage.
  REJECTED: ["REVIEWING", "ARCHIVED"],
  // #267 — ARCHIVED est terminal : toute sortie est refusée en 400.
  ARCHIVED: [],
};

export function isInternshipStatus(value: unknown): value is InternshipStatusValue {
  return (
    typeof value === "string" &&
    (INTERNSHIP_STATUSES as readonly string[]).includes(value)
  );
}

/** La transition est-elle autorisée ? (statut identique toujours autorisé) */
export function canTransitionInternshipStatus(
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  if (!isInternshipStatus(from) || !isInternshipStatus(to)) return false;
  return INTERNSHIP_STATUS_TRANSITIONS[from].includes(to);
}

export type InternshipStatusTransitionResult =
  | { ok: true; from: InternshipStatusValue | null; to: InternshipStatusValue | null }
  | { ok: false; status: 400; message: string; code: string };

/**
 * Valide une transition de statut de demande de stage.
 *
 * @param from statut courant en base (null si inconnu : ignoré)
 * @param to   statut demandé ; `null`/absent = no-op (le statut est inchangé)
 */
export function validateInternshipStatusTransition(input: {
  from?: string | null;
  to?: string | null;
}): InternshipStatusTransitionResult {
  const { from = null, to = null } = input;

  if (to == null) {
    return { ok: true, from: isInternshipStatus(from) ? from : null, to: null };
  }
  if (!isInternshipStatus(to)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INTERNSHIP_STATUS",
      message: `Statut de demande de stage invalide : ${String(to)}`,
    };
  }
  // Statut courant inconnu (donnée legacy / lecture indisponible) : on ne peut
  // pas juger la matrice, on se limite à valider la valeur demandée.
  if (from == null) {
    return { ok: true, from: null, to };
  }
  if (!isInternshipStatus(from)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INTERNSHIP_STATUS",
      message: `Statut de demande de stage courant inconnu : ${String(from)}`,
    };
  }
  if (!canTransitionInternshipStatus(from, to)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INTERNSHIP_STATUS_TRANSITION",
      message: `Transition de statut de demande de stage invalide : ${from} → ${to}`,
    };
  }
  return { ok: true, from, to };
}

/**
 * Statuts accessibles depuis un statut donné (le statut courant inclus : le
 * no-op est toujours autorisé). Une liste exploitable par l'UI pour n'afficher
 * que les actions valides.
 */
export function allowedNextInternshipStatuses(
  from: string | null | undefined,
): InternshipStatusValue[] {
  if (!isInternshipStatus(from)) return [...INTERNSHIP_STATUSES];
  return [from, ...INTERNSHIP_STATUS_TRANSITIONS[from]];
}
