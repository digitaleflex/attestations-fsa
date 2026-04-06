// lib/anti-cheat.ts
// Answer pattern analysis and cheating detection
import { prisma } from "@/lib/prisma";

export interface AnswerPattern {
  userId: string;
  examId: string;
  answers: Record<string, string>;
  timestamp: number;
}

export interface CheatingDetection {
  isSuspicious: boolean;
  flags: DetectionFlag[];
  similarityScore?: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
}

export interface DetectionFlag {
  type: DetectionType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
  score?: number;
}

export type DetectionType =
  | "IDENTICAL_ANSWERS"
  | "SUSPICIOUS_TIMING"
  | "ANSWER_PATTERN_MATCH"
  | "RAPID_SUBMISSION"
  | "COPY_DETECTED"
  | "STATISTICAL_ANOMALY";

/**
 * Analyze answer patterns for a submission
 * Returns detection flags if suspicious patterns are found
 */
export async function analyzeAnswerPattern(
  currentAnswers: Record<string, string>,
  examId: string,
  userId: string,
): Promise<CheatingDetection> {
  const flags: DetectionFlag[] = [];

  // Get all other submissions for this exam
  const otherSessions = await prisma.examSession.findMany({
    where: {
      examId,
      userId: { not: userId },
      status: { in: ["COMPLETED", "GRADED"] },
    },
    select: {
      userId: true,
      answers: true,
      submittedAt: true,
    },
  });

  // Filter out sessions with no answers
  const validSessions = otherSessions.filter(
    (s: { answers: any }) => s.answers !== null,
  );

  if (validSessions.length === 0) {
    return { isSuspicious: false, flags: [], confidence: "LOW" };
  }

  // Check for identical answers with other users
  const identicalMatches = checkIdenticalAnswers(currentAnswers, validSessions);
  if (identicalMatches.length > 0) {
    flags.push({
      type: "IDENTICAL_ANSWERS",
      severity: "CRITICAL",
      details: `Answers 100% identical with ${identicalMatches.length} other user(s): ${identicalMatches.map((m) => m.userId).join(", ")}`,
      score: 1.0,
    });
  }

  // Check for high similarity (>90% same answers)
  const highSimilarity = checkHighSimilarity(currentAnswers, validSessions);
  if (highSimilarity.length > 0) {
    flags.push({
      type: "ANSWER_PATTERN_MATCH",
      severity: "HIGH",
      details: `High similarity (${highSimilarity.map((s) => `${(s.score * 100).toFixed(0)}%`).join(", ")}) with other users`,
      score: Math.max(...highSimilarity.map((s) => s.score)),
    });
  }

  // Check for rapid submission pattern
  const totalAnswers = Object.keys(currentAnswers).length;
  if (totalAnswers > 10) {
    flags.push({
      type: "STATISTICAL_ANOMALY",
      severity: "LOW",
      details: `Submission with ${totalAnswers} answers - pattern will be monitored`,
    });
  }

  return {
    isSuspicious: flags.length > 0,
    flags,
    similarityScore: flags.find((f) => f.type === "ANSWER_PATTERN_MATCH")
      ?.score,
    confidence: flags.some((f) => f.severity === "CRITICAL")
      ? "HIGH"
      : flags.some((f) => f.severity === "HIGH")
        ? "MEDIUM"
        : "LOW",
  };
}

/**
 * Check if answers are 100% identical with other submissions
 */
function checkIdenticalAnswers(
  currentAnswers: Record<string, string>,
  otherSessions: { userId: string; answers: any; submittedAt: Date | null }[],
): { userId: string; score: number }[] {
  const matches: { userId: string; score: number }[] = [];

  for (const session of otherSessions) {
    if (!session.answers || typeof session.answers !== "object") continue;

    const otherAnswers = session.answers as Record<string, string>;
    const currentKeys = Object.keys(currentAnswers);
    const otherKeys = Object.keys(otherAnswers);

    // Must have same number of answers
    if (currentKeys.length !== otherKeys.length) continue;

    // Check if all answers match
    const allMatch = currentKeys.every(
      (key) => currentAnswers[key] === otherAnswers[key],
    );

    if (allMatch) {
      matches.push({ userId: session.userId, score: 1.0 });
    }
  }

  return matches;
}

/**
 * Check for high similarity (>90%) with other submissions
 */
function checkHighSimilarity(
  currentAnswers: Record<string, string>,
  otherSessions: { userId: string; answers: any; submittedAt: Date | null }[],
): { userId: string; score: number }[] {
  const similarities: { userId: string; score: number }[] = [];
  const currentKeys = Object.keys(currentAnswers);

  for (const session of otherSessions) {
    if (!session.answers || typeof session.answers !== "object") continue;

    const otherAnswers = session.answers as Record<string, string>;
    const otherKeys = Object.keys(otherAnswers);

    // Calculate Jaccard similarity
    const commonKeys = currentKeys.filter((key) => otherKeys.includes(key));
    const matchingAnswers = commonKeys.filter(
      (key) => currentAnswers[key] === otherAnswers[key],
    ).length;

    if (commonKeys.length > 0) {
      const similarity = matchingAnswers / commonKeys.length;
      if (similarity > 0.9) {
        similarities.push({ userId: session.userId, score: similarity });
      }
    }
  }

  return similarities;
}

/**
 * Log cheating detection to SecurityLog table
 */
export async function logCheatingDetection(
  userId: string,
  examId: string,
  ipAddress: string,
  userAgent: string,
  detection: CheatingDetection,
): Promise<void> {
  for (const flag of detection.flags) {
    await prisma.securityLog.create({
      data: {
        eventType: "CHEATING_DETECTED",
        userId,
        ipAddress,
        userAgent,
        resource: "exam_submission",
        resourceId: examId,
        action: flag.type,
        status: "FLAGGED",
        severity: flag.severity,
        details: {
          flagType: flag.type,
          severity: flag.severity,
          details: flag.details,
          score: flag.score,
          confidence: detection.confidence,
          similarityScore: detection.similarityScore,
        } as any,
      },
    });
  }
}

/**
 * Get all flagged submissions for an exam (admin view)
 */
export async function getFlaggedSubmissions(examId: string) {
  return prisma.securityLog.findMany({
    where: {
      resourceId: examId,
      resource: "exam_submission",
      eventType: "CHEATING_DETECTED",
    },
    orderBy: {
      timestamp: "desc",
    },
  });
}
