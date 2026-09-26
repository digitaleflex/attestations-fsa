import { prisma } from "@/lib/prisma";
import { getAppTimeZone, hasOpened, resolveOpensOn } from "@/lib/exams/time";

/**
 * Sémantique unique de visibilité des examens.
 * DRAFT / ARCHIVED ne sont jamais exposés publiquement.
 */
export const VISIBLE_EXAM_STATUSES = ["SCHEDULED", "PUBLISHED"] as const;

export type VisibleExamStatus = (typeof VISIBLE_EXAM_STATUSES)[number];

function isVisibleStatus(status: string): status is VisibleExamStatus {
  return (VISIBLE_EXAM_STATUSES as readonly string[]).includes(status);
}

/** Champs minimaux nécessaires à la règle de visibilité « jour J ». */
export interface ExamVisibilityInput {
  status: string;
  /** Ouverture planifiée (nouveau champ `Exam.opensOn`). */
  opensOn?: Date | string | null;
  /** Heure de démarrage (existante) ; sert aussi de repli historique. */
  scheduledAt?: Date | string | null;
}

/**
 * Ouverture EFFECTIVE d'un examen : minuit du jour d'ouverture dans
 * `APP_TIMEZONE`.
 *
 * Repli des examens existants (`opensOn` nul) : le jour local de `scheduledAt`.
 * Sans date du tout, l'examen n'a pas d'ouverture (jamais visible).
 */
export function getExamOpensOn(
  exam: ExamVisibilityInput,
  timeZone: string = getAppTimeZone(),
): Date | null {
  return resolveOpensOn(exam, timeZone);
}

/**
 * Règle de visibilité « jour J ».
 *
 * Un examen est VISIBLE ( identifiable : titre, date d'ouverture, heure prévue )
 * dès `00:00:00 Africa/Porto-Novo` le jour de son ouverture, et uniquement à
 * partir de ce moment-là. Avant J : rien n'est exposé. La visibilité est
 * purement temporelle : elle ne préjuge pas du verrouillage du bouton
 * « Commencer », qui dépend de `isExamAvailable` / `scheduledAt`.
 *
 * Comparaisons en UTC via `APP_TIMEZONE` — jamais le fuseau de la machine.
 */
export function isExamVisible(
  exam: ExamVisibilityInput,
  now: Date = new Date(),
  timeZone: string = getAppTimeZone(),
): boolean {
  if (!isVisibleStatus(exam.status)) return false;
  const opensOn = getExamOpensOn(exam, timeZone);
  if (opensOn == null) return false;
  return opensOn.getTime() <= now.getTime();
}


/**
 * Un examen est ACCESSIBLE (démarrable) uniquement si :
 * - son statut est PUBLISHED ou SCHEDULED, ET
 * - `scheduledAt` est défini et déjà atteint.
 * Un examen PUBLISHED sans date, ou avec une date future, reste verrouillé.
 * DRAFT / ARCHIVED ne sont jamais accessibles.
 *
 * #256 m9 — délégué à `lib/exams/time.ts` (`hasOpened`) : une seule définition
 * du jour J pour la disponibilité, la visibilité du contenu et les 423.
 */
export function isExamAvailable(
  exam: { status: string; scheduledAt: Date | null; opensOn?: Date | string | null },
  now: Date = new Date(),
): boolean {
  return hasOpened(exam, now);
}

/**
 * Bascule des examens `SCHEDULED` échus vers `PUBLISHED`.
 *
 * #256 m9 — RÉSERVÉ AU CRON INTERNE (`POST /api/internal/exams/open`, qui
 * journalise et invalide le cache via `lib/exams/cron-open.ts`). Aucune route
 * publique ne doit appeler cette fonction : une lecture ou un démarrage ne
 * déclenche plus de mutation. La disponibilité, elle, ne dépend pas du statut
 * courant (`hasOpened` accepte `SCHEDULED` échu), donc l'absence de cron ne
 * verrouille jamais un candidat.
 */
export async function autoOpenDueExams(now: Date = new Date()) {
  return prisma.exam.updateMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    data: { status: "PUBLISHED" },
  });
}
