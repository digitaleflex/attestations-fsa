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
  return status === "COMPLETED" || status === "GRADED";
}

/** Explicit candidate-session states that may transition to submitted. */
export function isSubmittableStatus(
  status: string | null | undefined,
): boolean {
  return status === "IN_PROGRESS" || status === "PENDING";
}

/** Explicit submitted-session states that an administrator may grade. */
export function isCorrectableStatus(
  status: string | null | undefined,
): boolean {
  return status === "PENDING_REVIEW" || status === "COMPLETED" || status === "GRADED";
}

/** Versioned scale frozen with a submission. */
export interface ScoringSnapshot {
  version: 1;
  maxPart1: number;
  maxPart2: number;
  maxPart3: number;
  totalMax: number;
}

export interface ScoringPartConfig extends ExamPartMaxConfig {
  type?: string | null;
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
  const part1 = exam.part1Enabled === false ? 0 : (exam.part1Points ?? 0);
  const part2 = exam.part2Enabled === false ? 0 : (exam.part2Points ?? 0);
  const part3 = exam.part3Enabled === false ? 0 : (exam.part3Points ?? 0);

  const sum = part1 + part2 + part3;
  if (sum > 0) return sum;

  return exam.totalPoints && exam.totalPoints > 0 ? exam.totalPoints : 100;
}

export interface ExamPartMaxConfig {
  points: number;
}

/**
 * Maximum reachable raw score derived from the REAL ExamPart rows.
 * Single source of truth for exams with multiple/renamed parts:
 * sums every part's points (legacy `partNPoints` only captured the
 * first part of each type, making `resolveExamMax` diverge from
 * `totalPoints`). Falls back to `resolveExamMax` when no parts exist.
 */
export function resolveExamMaxFromParts(
  parts: ExamPartMaxConfig[] | null | undefined,
  exam?: ExamPointConfig,
): number {
  if (parts && parts.length > 0) {
    const sum = parts.reduce((acc, p) => acc + (p.points || 0), 0);
    if (sum > 0) return sum;
  }
  return exam ? resolveExamMax(exam) : 100;
}

function positiveMax(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * Build the immutable scale used by both automatic submission and manual
 * correction. Real ExamPart rows win; legacy summary fields are the backwards
 * compatible fallback for historical exams that have no parts.
 */
export function createScoringSnapshot(
  parts: ScoringPartConfig[] | null | undefined,
  exam?: ExamPointConfig,
): ScoringSnapshot {
  const partMax = (type: string, fallback: number | null | undefined) => {
    if (parts && parts.length > 0) {
      return round2(
        parts
          .filter((part) => part.type === type)
          .reduce((sum, part) => sum + positiveMax(part.points), 0),
      );
    }
    return positiveMax(fallback);
  };

  const maxPart1 = partMax("QCM", exam?.part1Points);
  const maxPart2 = partMax("OPEN", exam?.part2Points);
  const maxPart3 = partMax("CASE_STUDY", exam?.part3Points);
  const derivedTotal = maxPart1 + maxPart2 + maxPart3;
  const totalMax = derivedTotal > 0
    ? round2(derivedTotal)
    : exam
      ? resolveExamMax(exam)
      : 100;

  return {
    version: 1,
    maxPart1,
    maxPart2,
    maxPart3,
    totalMax: round2(totalMax),
  };
}

/** Read only a complete, structurally valid version-1 snapshot. */
export function readScoringSnapshot(value: unknown): ScoringSnapshot | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const maxima = [raw.maxPart1, raw.maxPart2, raw.maxPart3, raw.totalMax];
  if (
    raw.version !== 1 ||
    maxima.some((max) => typeof max !== "number" || !Number.isFinite(max) || max < 0)
  ) {
    return null;
  }
  return {
    version: 1,
    maxPart1: raw.maxPart1 as number,
    maxPart2: raw.maxPart2 as number,
    maxPart3: raw.maxPart3 as number,
    totalMax: raw.totalMax as number,
  };
}

export function readSubmissionScoringSnapshot(
  answers: unknown,
): ScoringSnapshot | null {
  if (answers === null || typeof answers !== "object" || Array.isArray(answers)) {
    return null;
  }
  return readScoringSnapshot(
    (answers as Record<string, unknown>)._customBareme,
  );
}

export function withScoringSnapshot(
  answers: Record<string, unknown>,
  snapshot: ScoringSnapshot,
): Record<string, unknown> {
  return { ...answers, _customBareme: snapshot };
}

export interface CanonicalScoreResult {
  scorePart1: number;
  scorePart2: number | null;
  scorePart3: number | null;
  totalScore: number;
  finalScore: number;
}

/** Single calculation path for submission and correction. */
export function calculateCanonicalScore(
  snapshot: ScoringSnapshot,
  scores: {
    part1: number;
    part2?: number | null;
    part3?: number | null;
  },
  fullyCorrected: boolean,
): CanonicalScoreResult {
  const scorePart1 = round2(scores.part1);
  const scorePart2 = scores.part2 == null ? null : round2(scores.part2);
  const scorePart3 = scores.part3 == null ? null : round2(scores.part3);
  const totalScore = round2(
    scorePart1 + (scorePart2 ?? 0) + (scorePart3 ?? 0),
  );
  return {
    scorePart1,
    scorePart2,
    scorePart3,
    totalScore,
    finalScore: fullyCorrected
      ? Math.min(computeFinalScore(totalScore, snapshot.totalMax), 100)
      : 0,
  };
}

/** Raw points for an auto-graded QCM part. */
export function computePart1Score(
  correctAnswers: number,
  totalQuestions: number,
  part1Points: number,
): number {
  if (totalQuestions <= 0 || part1Points <= 0) return 0;
  const clamped = Math.min(Math.max(correctAnswers, 0), totalQuestions);
  return round2((clamped / totalQuestions) * part1Points);
}

/** Convert a raw total score to a 0..100 percentage. */
export function computeFinalScore(
  totalScore: number,
  totalPoints: number,
): number {
  if (totalPoints <= 0) return 0;
  return round2((totalScore / totalPoints) * 100);
}

/** Whether a percentage score reaches the exam passing threshold (default 65). */
export function isPassed(
  finalScore: number,
  passingScore: number | null | undefined,
): boolean {
  return finalScore >= (passingScore ?? 65);
}

/** Canonical certification mentions (mirrors the Prisma `CertificationMention` enum). */
export type CertificationMention =
  "PASSABLE" | "ASSEZ_BIEN" | "BIEN" | "TRES_BIEN" | "EXCELLENCE";

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
