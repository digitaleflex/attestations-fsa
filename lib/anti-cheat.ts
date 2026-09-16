// lib/anti-cheat.ts
// Answer pattern analysis and cheating detection
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

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

// #129 — échantillon minimum de réponses communes avant de comparer la
// similarité entre deux copies (évite les faux positifs sur petits échantillons).
const MIN_SIMILARITY_SAMPLE = 5;

type SessionData = {
  userId: string;
  answers: Prisma.JsonValue;
  submittedAt: Date | null;
};

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

  const otherSessions: SessionData[] = await prisma.examSession.findMany({
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

  const validSessions = otherSessions.filter(
    (s: SessionData): s is SessionData => s.answers !== null,
  );

  if (validSessions.length === 0) {
    return { isSuspicious: false, flags: [], confidence: "LOW" };
  }

  const identicalMatches = checkIdenticalAnswers(currentAnswers, validSessions);
  if (identicalMatches.length > 0) {
    flags.push({
      type: "IDENTICAL_ANSWERS",
      severity: "CRITICAL",
      details: `Answers 100% identical with ${identicalMatches.length} other user(s): ${identicalMatches.map((m) => m.userId).join(", ")}`,
      score: 1.0,
    });
  }

  const highSimilarity = checkHighSimilarity(currentAnswers, validSessions);
  if (highSimilarity.length > 0) {
    flags.push({
      type: "ANSWER_PATTERN_MATCH",
      severity: "HIGH",
      details: `High similarity (${highSimilarity.map((s) => `${(s.score * 100).toFixed(0)}%`).join(", ")}) with other users`,
      score: Math.max(...highSimilarity.map((s) => s.score)),
    });
  }

  // #129 — le seuil « >10 réponses » générait un STATISTICAL_ANOMALY sur
  // presque tout examen normal (isSuspicious=true à tort) : supprimé.

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

function checkIdenticalAnswers(
  currentAnswers: Record<string, string>,
  otherSessions: SessionData[],
): { userId: string; score: number }[] {
  const matches: { userId: string; score: number }[] = [];

  for (const session of otherSessions) {
    if (!session.answers || typeof session.answers !== "object") continue;

    const otherAnswers = session.answers as Record<string, string>;
    const currentKeys = Object.keys(currentAnswers);
    const otherKeys = Object.keys(otherAnswers);

    // #129 — deux copies vides (0 clé) ne sont PAS « 100 % identiques » :
    // exiger un échantillon réel avant comparaison.
    if (currentKeys.length === 0 || otherKeys.length === 0) continue;
    if (currentKeys.length !== otherKeys.length) continue;

    const allMatch = currentKeys.every(
      (key) => currentAnswers[key] === otherAnswers[key],
    );

    if (allMatch) {
      matches.push({ userId: session.userId, score: 1.0 });
    }
  }

  return matches;
}

function checkHighSimilarity(
  currentAnswers: Record<string, string>,
  otherSessions: SessionData[],
): { userId: string; score: number }[] {
  const similarities: { userId: string; score: number }[] = [];
  const currentKeys = Object.keys(currentAnswers);

  for (const session of otherSessions) {
    if (!session.answers || typeof session.answers !== "object") continue;

    const otherAnswers = session.answers as Record<string, string>;
    const otherKeys = Object.keys(otherAnswers);

    const commonKeys = currentKeys.filter((key) => otherKeys.includes(key));
    const matchingAnswers = commonKeys.filter(
      (key) => currentAnswers[key] === otherAnswers[key],
    ).length;

    // #129 — similarité > 0.9 sans échantillon minimum = faux positif
    // (2 réponses communes sur 2 suffisaient). Exiger un échantillon réel.
    if (commonKeys.length >= MIN_SIMILARITY_SAMPLE) {
      const similarity = matchingAnswers / commonKeys.length;
      if (similarity > 0.9) {
        similarities.push({ userId: session.userId, score: similarity });
      }
    }
  }

  return similarities;
}

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
        },
      },
    });
  }
}

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
