/**
 * #256 m9 — Transitions de statut d'un examen (côté admin).
 *
 * Toute mutation de `Exam.status` passe par `validateExamStatusTransition` :
 * une transition hors matrice est refusée en 400 AVANT toute écriture, pour ne
 * jamais laisser un examen dans un statut incohérent (ex. un examen ARCHIVED
 * remis en ligne sans repasser par DRAFT, ou un SCHEDULED sans date d'ouverture
 * qui resterait verrouillé à jamais).
 *
 * La matrice est volontairement stricte sur les transitions « depublication »
 * et laxiste sur les transitions de préparation : un brouillon peut être
 * programmé, publié ou archivé sans étape intermédiaire.
 */

export const EXAM_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "SCHEDULED",
  "ARCHIVED",
] as const;

export type ExamStatusValue = (typeof EXAM_STATUSES)[number];

/** Matrice des transitions autorisées (hors transition vers le même statut). */
export const EXAM_STATUS_TRANSITIONS: Readonly<
  Record<ExamStatusValue, readonly ExamStatusValue[]>
> = {
  // Un brouillon est modifiable librement puis publiable / programmable.
  DRAFT: ["PUBLISHED", "SCHEDULED", "ARCHIVED"],
  // Reprogrammation possible tant que l'examen n'est pas en ligne.
  SCHEDULED: ["PUBLISHED", "DRAFT", "ARCHIVED"],
  // Un examen en ligne ne se « dé-publie » pas en DRAFT : il s'archive, ou il
  // est reprogrammé (reverrouillage temporaire).
  PUBLISHED: ["SCHEDULED", "ARCHIVED"],
  // Un examen archivé ne redevient visible qu'après un retour en brouillon.
  ARCHIVED: ["DRAFT"],
};

export function isExamStatus(value: unknown): value is ExamStatusValue {
  return (
    typeof value === "string" &&
    (EXAM_STATUSES as readonly string[]).includes(value)
  );
}

/** La transition est-elle autorisée ? (statut identique toujours autorisé) */
export function canTransitionExamStatus(
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  if (!isExamStatus(from) || !isExamStatus(to)) return false;
  return EXAM_STATUS_TRANSITIONS[from].includes(to);
}

export type ExamStatusTransitionResult =
  | { ok: true; from: ExamStatusValue | null; to: ExamStatusValue | null }
  | { ok: false; status: 400; message: string; code: string };

/**
 * Valide une transition de statut.
 *
 * @param from           statut courant en base (null si inconnu : ignoré)
 * @param to             statut demandé (undefined/null/absent : ignoré)
 * @param scheduledAt    date d'ouverture APRÈS application du patch
 *                       (null si inchangée ET absente de la base)
 */
export function validateExamStatusTransition(input: {
  from?: string | null;
  to?: string | null;
  scheduledAt?: Date | null;
}): ExamStatusTransitionResult {
  const { from = null, to = null, scheduledAt = null } = input;

  if (to == null) {
    return { ok: true, from: isExamStatus(from) ? from : null, to: null };
  }
  if (!isExamStatus(to)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_EXAM_STATUS",
      message: `Statut d'examen invalide : ${String(to)}`,
    };
  }
  // Statut courant inconnu (donnée legacy / lecture non disponible) : on ne
  // peut pas juger la matrice, on se limite à valider la valeur demandée.
  if (from == null) {
    return { ok: true, from: null, to };
  }
  if (!isExamStatus(from)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_EXAM_STATUS",
      message: `Statut d'examen courant inconnu : ${String(from)}`,
    };
  }
  if (!canTransitionExamStatus(from, to)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_EXAM_STATUS_TRANSITION",
      message: `Transition de statut d'examen invalide : ${from} → ${to}`,
    };
  }
  // Un examen programmé sans date d'ouverture ne s'ouvrirait jamais.
  if (to === "SCHEDULED" && scheduledAt == null) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_SCHEDULED_AT",
      message:
        "Un examen programmé (SCHEDULED) doit porter une date d'ouverture (scheduledAt).",
    };
  }
  return { ok: true, from, to };
}
