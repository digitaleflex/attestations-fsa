import { prisma } from "@/lib/prisma";

/**
 * Sémantique unique de visibilité des examens.
 * DRAFT / ARCHIVED ne sont jamais exposés publiquement.
 */
export const VISIBLE_EXAM_STATUSES = ["SCHEDULED", "PUBLISHED"] as const;

/**
 * Un examen est DISPONIBLE (démarrable) si :
 * - il est PUBLISHED, ou
 * - il est SCHEDULED avec une date planifiée déjà atteinte.
 */
export function isExamAvailable(
  exam: { status: string; scheduledAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (exam.status === "PUBLISHED") return true;
  if (exam.status === "SCHEDULED") {
    return (
      exam.scheduledAt != null &&
      new Date(exam.scheduledAt).getTime() <= now.getTime()
    );
  }
  return false;
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
