/**
 * scripts/check-data-integrity.ts
 *
 * AUDIT EN LECTURE SEULE de l'intégrité des données (issue #146, A5).
 * N'écrit JAMAIS en base. Vérifie :
 *   1. Intégrité référentielle (FK orphelines) ;
 *   2. Doublons de clés métier (ExamSession(userId, examId) — cf. #121) ;
 *   3. Cohérence des scores (bornes 0..100, parts vs total, max) ;
 *   4. Cohérence des attestations (code, statut vs score) ;
 *   5. Anomalies de statut de session.
 *
 * Usage :
 *   pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-data-integrity.ts
 *
 * Sortie : rapport console + code de sortie 1 si au moins une anomalie CRITIQUE.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { isCorrected, resolveExamMax } from "../lib/exams/scoring";

const prisma = new PrismaClient();
const EPS = 0.009;

type Severity = "CRITICAL" | "WARNING";
interface Finding {
  severity: Severity;
  check: string;
  detail: string;
}

const findings: Finding[] = [];
function report(severity: Severity, check: string, detail: string) {
  findings.push({ severity, check, detail });
}

async function main() {
  // ── 1. Intégrité référentielle (FK orphelines) ──────────────────────────
  // ExamSession → Exam / User
  const sessions = await prisma.examSession.findMany({
    select: { id: true, examId: true, userId: true },
  });
  const examIds = new Set(
    (await prisma.exam.findMany({ select: { id: true } })).map((e) => e.id),
  );
  const userIds = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id),
  );
  for (const s of sessions) {
    if (!examIds.has(s.examId))
      report("CRITICAL", "FK ExamSession.examId", `session ${s.id} → exam ${s.examId} inexistant`);
    if (!userIds.has(s.userId))
      report("CRITICAL", "FK ExamSession.userId", `session ${s.id} → user ${s.userId} inexistant`);
  }

  // Attestation → User / Formation
  const attestations = await prisma.attestation.findMany({
    select: {
      id: true,
      code: true,
      userId: true,
      formationId: true,
      status: true,
      certificationScore: true,
    },
  });
  const formationIds = new Set(
    (await prisma.formation.findMany({ select: { id: true } })).map((f) => f.id),
  );
  for (const a of attestations) {
    if (!formationIds.has(a.formationId))
      report("CRITICAL", "FK Attestation.formationId", `attestation ${a.code} → formation ${a.formationId} inexistante`);
  }

  // ── 2. Doublons ExamSession(userId, examId) — contrat #121 ─────────────
  const seen = new Map<string, string>();
  for (const s of sessions) {
    const key = `${s.userId}::${s.examId}`;
    if (seen.has(key)) {
      report("CRITICAL", "Doublon ExamSession(userId, examId)", `clé ${key} (sessions ${seen.get(key)} et ${s.id})`);
    } else {
      seen.set(key, s.id);
    }
  }

  // ── 3. Cohérence des scores ────────────────────────────────────────────
  const exams = await prisma.exam.findMany({
    select: {
      id: true,
      part1Points: true,
      part2Points: true,
      part3Points: true,
      part1Enabled: true,
      part2Enabled: true,
      part3Enabled: true,
      totalPoints: true,
    },
  });
  const examById = new Map(exams.map((e) => [e.id, e]));
  const fullSessions = await prisma.examSession.findMany({
    select: {
      id: true,
      examId: true,
      status: true,
      scorePart1: true,
      scorePart2: true,
      scorePart3: true,
      totalScore: true,
      finalScore: true,
      internshipScore: true,
    },
  });
  for (const s of fullSessions) {
    if (s.finalScore < -EPS || s.finalScore > 100 + EPS)
      report("CRITICAL", "finalScore hors bornes", `session ${s.id} : finalScore=${s.finalScore}`);
    if (s.totalScore < -EPS)
      report("WARNING", "totalScore négatif", `session ${s.id} : totalScore=${s.totalScore}`);
    if (s.internshipScore < -EPS || s.internshipScore > 100 + EPS)
      report("WARNING", "internshipScore hors bornes", `session ${s.id} : internshipScore=${s.internshipScore}`);

    const exam = examById.get(s.examId);
    if (!exam) continue;
    const max = resolveExamMax(exam);
    const parts = [s.scorePart1, s.scorePart2, s.scorePart3].filter(
      (v): v is number => v != null,
    );
    const sum = parts.reduce((a, b) => a + b, 0);
    if (isCorrected(s.status) && Math.abs(sum - s.totalScore) > EPS) {
      report("WARNING", "totalScore ≠ somme des parts", `session ${s.id} : ${s.totalScore} vs ${sum}`);
    }
    // Une partie activée ne peut pas dépasser son barème
    if (exam.part1Enabled && s.scorePart1 > exam.part1Points + EPS)
      report("WARNING", "scorePart1 > barème", `session ${s.id} : ${s.scorePart1} > ${exam.part1Points}`);
    if (exam.part2Enabled && s.scorePart2 != null && s.scorePart2 > exam.part2Points + EPS)
      report("WARNING", "scorePart2 > barème", `session ${s.id} : ${s.scorePart2} > ${exam.part2Points}`);
    if (exam.part3Enabled && s.scorePart3 != null && s.scorePart3 > exam.part3Points + EPS)
      report("WARNING", "scorePart3 > barème", `session ${s.id} : ${s.scorePart3} > ${exam.part3Points}`);
    if (s.totalScore > max + EPS)
      report("WARNING", "totalScore > max examen", `session ${s.id} : ${s.totalScore} > ${max}`);
  }

  // ── 4. Cohérence des attestations ──────────────────────────────────────
  const CODE_RE = /^FSA-\d{4}-M\d{2}-\d{5}-[0-9a-f]{5}$/;
  for (const a of attestations) {
    if (!CODE_RE.test(a.code))
      report("WARNING", "Format de code attestation", `« ${a.code} » ne respecte pas FSA-YYYY-MXX-NNNNN-hash`);
    if (a.status === "REJECTED" && (a.certificationScore ?? 0) > 0)
      report("WARNING", "Attestation REJECTED avec score > 0", `${a.code} : score=${a.certificationScore ?? 0} (attendu : informatif)`);
  }

  // ── 5. Anomalies de statut de session ──────────────────────────────────
  for (const s of fullSessions) {
    if (s.status === "GRADED" && s.scorePart2 == null)
      report("CRITICAL", "Session GRADED avec scorePart2 null", `session ${s.id} (sentinelle #117 contournée)`);
    if (s.status === "IN_PROGRESS" && s.totalScore > 0)
      report("WARNING", "Session IN_PROGRESS avec score", `session ${s.id} : totalScore=${s.totalScore}`);
  }

  // ── Rapport ────────────────────────────────────────────────────────────
  const critical = findings.filter((f) => f.severity === "CRITICAL");
  const warnings = findings.filter((f) => f.severity === "WARNING");

  console.log("\n=== RAPPORT D'INTÉGRITÉ DES DONNÉES (#146) ===");
  console.log(`Sessions : ${sessions.length} · Attestations : ${attestations.length} · Examens : ${exams.length}`);
  console.log(`Anomalies : ${critical.length} critique(s), ${warnings.length} avertissement(s)\n`);

  if (findings.length === 0) {
    console.log("✅ Aucune anomalie détectée.");
  } else {
    for (const f of findings) {
      console.log(`[${f.severity}] ${f.check} — ${f.detail}`);
    }
  }

  await prisma.$disconnect();
  // Code de sortie non-zéro si anomalie critique (utilisable en CI/cron)
  if (critical.length > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error("[CHECK_INTEGRITY_ERROR]", e);
  await prisma.$disconnect();
  process.exit(1);
});
