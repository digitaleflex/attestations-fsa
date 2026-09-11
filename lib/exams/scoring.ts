// lib/exams/scoring.ts
// Canonical, side-effect-free scoring helpers for exams.
//
// Scale contract (single source of truth):
//   - scorePartN  : RAW points earned for part N (0 .. exam.partNPoints)
//   - totalScore  : sum of raw points (0 .. resolveExamMax(exam))
//   - finalScore  : PERCENTAGE 0..100 = totalScore / maxPoints * 100
//   - passingScore: threshold expressed as a PERCENTAGE (e.g. 65)
//
// Only sessions whose status is COMPLETED or GRADED are considered "corrected".

/** Round to 2 decimals, avoiding common floating point drift. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** A session is "corrected" only once its score is final. */
export function isCorrected(status: string | null | undefined): boolean {
  return status === 'COMPLETED' || status === 'GRADED';
}

export interface ExamPointConfig {
  totalPoints?: number | null;
  part1Points?: number | null;
  part2Points?: number | null;
  part3Points?: number | null;
  part1Enabled?: boolean | null;
  part2Enabled?: boolean | null;
  part3Enabled?: boolean | null;
}

/**
 * Maximum reachable raw score for an exam.
 * Sums the enabled parts' points; falls back to `totalPoints`, then 100.
 */
export function resolveExamMax(exam: ExamPointConfig): number {
  const part1 = exam.part1Enabled === false ? 0 : exam.part1Points ?? 0;
  const part2 = exam.part2Enabled === false ? 0 : exam.part2Points ?? 0;
  const part3 = exam.part3Enabled === false ? 0 : exam.part3Points ?? 0;

  const sum = part1 + part2 + part3;
  if (sum > 0) return sum;

  return exam.totalPoints && exam.totalPoints > 0 ? exam.totalPoints : 100;
}

/** Raw points for an auto-graded QCM part. */
export function computePart1Score(
  correctAnswers: number,
  totalQuestions: number,
  part1Points: number
): number {
  if (totalQuestions <= 0 || part1Points <= 0) return 0;
  const clamped = Math.min(Math.max(correctAnswers, 0), totalQuestions);
  return round2((clamped / totalQuestions) * part1Points);
}

/** Convert a raw total score to a 0..100 percentage. */
export function computeFinalScore(totalScore: number, totalPoints: number): number {
  if (totalPoints <= 0) return 0;
  return round2((totalScore / totalPoints) * 100);
}

/** Whether a percentage score reaches the exam passing threshold (default 65). */
export function isPassed(
  finalScore: number,
  passingScore: number | null | undefined
): boolean {
  return finalScore >= (passingScore ?? 65);
}

/** Canonical certification mentions (mirrors the Prisma `CertificationMention` enum). */
export type CertificationMention =
  | "PASSABLE"
  | "ASSEZ_BIEN"
  | "BIEN"
  | "TRES_BIEN"
  | "EXCELLENCE";

/**
 * Single source of truth for certification mentions, from a 0..100 percentage.
 * Thresholds: 90 Excellence, 80 Très Bien, 70 Bien, 65 Assez Bien, sinon Passable.
 */
export function resolveMention(finalScore: number): CertificationMention {
  if (finalScore >= 90) return "EXCELLENCE";
  if (finalScore >= 80) return "TRES_BIEN";
  if (finalScore >= 70) return "BIEN";
  if (finalScore >= 65) return "ASSEZ_BIEN";
  return "PASSABLE";
}
