import { prisma } from "@/lib/prisma";

/**
 * Sémantique unique de visibilité des examens.
 * DRAFT / ARCHIVED ne sont jamais exposés publiquement.
 */
export const VISIBLE_EXAM_STATUSES = ["SCHEDULED", "PUBLISHED"] as const;

/**
 * Un examen est ACCESSIBLE (démarrable) uniquement si :
 * - son statut est PUBLISHED ou SCHEDULED, ET
 * - `scheduledAt` est défini et déjà atteint.
 * Un examen PUBLISHED sans date, ou avec une date future, reste verrouillé.
 * DRAFT / ARCHIVED ne sont jamais accessibles.
 */
export function isExamAvailable(
  exam: { status: string; scheduledAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (exam.status !== "PUBLISHED" && exam.status !== "SCHEDULED") return false;
  if (exam.scheduledAt == null) return false;
  return new Date(exam.scheduledAt).getTime() <= now.getTime();
}

/**
 * Ouvre automatiquement les examens SCHEDULED dont l'heure est atteinte.
 * Basculage paresseux (lazy) déclenché lors des lectures / démarrages.
 * Aucun cron requis.
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
