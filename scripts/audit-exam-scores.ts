/**
 * scripts/audit-exam-scores.ts
 *
 * AUDIT EN LECTURE SEULE des scores des ExamSession.
 * N'écrit JAMAIS en base. Affiche :
 *   - le barème de chaque examen (parts activées, points, total, seuil) ;
 *   - chaque session (statut, parts, totalScore, finalScore, score, has_bareme) ;
 *   - les anomalies détectées (parts hors barème, total != somme des parts,
 *     sessions corrigées avec finalScore incohérent).
 *
 * Usage :
 *   pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/audit-exam-scores.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  round2,
  isCorrected,
  resolveExamMax,
  computeFinalScore,
} from '../lib/exams/scoring';

const prisma = new PrismaClient();

/** Tolérance de comparaison pour éviter le bruit flottant. */
const EPS = 0.009;

/** Sous-ensemble du barème d'un examen exploité ici. */
interface ExamBareme {
  id: string;
  title: string;
  part1Enabled: boolean;
  part1Points: number;
  part2Enabled: boolean;
  part2Points: number;
  part3Enabled: boolean;
  part3Points: number;
  totalPoints: number;
  passingScore: number;
}

interface CustomBareme {
  maxPart1: number | null;
  maxPart2: number | null;
  maxPart3: number | null;
  totalMax: number | null;
}

type SessionRow = {
  id: string;
  status: string;
  scorePart1: number;
  scorePart2: number;
  scorePart3: number;
  score: number;
  totalScore: number;
  finalScore: number;
  answers: unknown;
  exam: ExamBareme;
  candidate: { name: string | null; email: string | null };
};

/** Extrait `answers._customBareme` sans jamais utiliser `any`. */
function getCustomBareme(answers: unknown): CustomBareme | null {
  if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) {
    return null;
  }
  const record = answers as Record<string, unknown>;
  const raw = record._customBareme;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const cb = raw as Record<string, unknown>;
  const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  return {
    maxPart1: num(cb.maxPart1),
    maxPart2: num(cb.maxPart2),
    maxPart3: num(cb.maxPart3),
    totalMax: num(cb.totalMax),
  };
}

/**
 * Barème effectif d'une part : le `_customBareme` enregistré au moment de la
 * correction prime sur la configuration de l'examen (comportement de l'app).
 */
function effectivePartMax(
  exam: ExamBareme,
  cb: CustomBareme | null,
  part: 1 | 2 | 3,
): number {
  const override =
    part === 1 ? cb?.maxPart1 : part === 2 ? cb?.maxPart2 : cb?.maxPart3;
  if (typeof override === 'number' && override > 0) return override;

  if (part === 1) return exam.part1Enabled === false ? 0 : exam.part1Points;
  if (part === 2) return exam.part2Enabled === false ? 0 : exam.part2Points;
  return exam.part3Enabled === false ? 0 : exam.part3Points;
}

function fmt(value: number): string {
  return round2(value).toFixed(2);
}

/** Rendu d'un tableau texte aligné. */
function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? '').length)),
  );
  const renderRow = (cells: string[]): string =>
    cells
      .map((cell, index) => ` ${(cell ?? '').padEnd(widths[index])} `)
      .join('|');
  const separator = widths.map((width) => '-'.repeat(width + 2)).join('+');
  return [renderRow(headers), separator, ...rows.map(renderRow)].join('\n');
}

async function main(): Promise<void> {
  const sessions = (await prisma.examSession.findMany({
    include: {
      exam: true,
      candidate: { select: { name: true, email: true } },
    },
    orderBy: { startedAt: 'asc' },
  })) as SessionRow[];

  console.log('================================================================');
  console.log(` AUDIT DES SCORES — ExamSession (lecture seule)`);
  console.log('================================================================');
  console.log(`Sessions trouvées : ${sessions.length}`);
  console.log(`Date de l'audit  : ${new Date().toISOString()}`);

  // ── Barèmes des examens ─────────────────────────────────────────────────
  const exams = new Map<string, ExamBareme>();
  for (const session of sessions) exams.set(session.exam.id, session.exam);

  console.log('\n── Barèmes des examens ──');
  const examRows = [...exams.values()].map((exam) => [
    exam.id.slice(0, 8),
    exam.title,
    `${exam.part1Enabled ? 'on' : 'off'}/${exam.part1Points}`,
    `${exam.part2Enabled ? 'on' : 'off'}/${exam.part2Points}`,
    `${exam.part3Enabled ? 'on' : 'off'}/${exam.part3Points}`,
    String(exam.totalPoints),
    fmt(resolveExamMax(exam)),
    String(exam.passingScore),
  ]);
  console.log(
    renderTable(
      ['exam', 'titre', 'P1(on/pts)', 'P2(on/pts)', 'P3(on/pts)', 'totalPts', 'maxEff', 'seuil'],
      examRows,
    ),
  );

  // ── Sessions ────────────────────────────────────────────────────────────
  console.log('\n── Sessions ──');
  const sessionRows = sessions.map((session, index) => {
    const cb = getCustomBareme(session.answers);
    const max1 = effectivePartMax(session.exam, cb, 1);
    const max2 = effectivePartMax(session.exam, cb, 2);
    const max3 = effectivePartMax(session.exam, cb, 3);
    return [
      String(index + 1),
      session.id.slice(0, 8),
      session.status,
      `${fmt(session.scorePart1)}/${max1}`,
      `${fmt(session.scorePart2)}/${max2}`,
      `${fmt(session.scorePart3)}/${max3}`,
      fmt(session.totalScore),
      fmt(session.finalScore),
      fmt(session.score),
      cb ? 'oui' : 'non',
    ];
  });
  console.log(
    renderTable(
      ['#', 'session', 'statut', 'P1', 'P2', 'P3', 'total', 'final', 'score', 'bareme?'],
      sessionRows,
    ),
  );

  // ── Anomalies ───────────────────────────────────────────────────────────
  const anomaliesBySession: string[] = [];
  let anomalyCount = 0;

  for (const session of sessions) {
    const exam = session.exam;
    const cb = getCustomBareme(session.answers);
    const max1 = effectivePartMax(exam, cb, 1);
    const max2 = effectivePartMax(exam, cb, 2);
    const max3 = effectivePartMax(exam, cb, 3);
    const max = resolveExamMax(exam);

    const sum = round2(session.scorePart1 + session.scorePart2 + session.scorePart3);
    const expectedFinal = computeFinalScore(sum, max);
    const issues: string[] = [];

    if (session.scorePart1 < -EPS || session.scorePart1 > max1 + EPS) {
      issues.push(`P1 hors barème (${fmt(session.scorePart1)} / max ${max1})`);
    }
    if (session.scorePart2 < -EPS || session.scorePart2 > max2 + EPS) {
      issues.push(`P2 hors barème (${fmt(session.scorePart2)} / max ${max2})`);
    }
    if (session.scorePart3 < -EPS || session.scorePart3 > max3 + EPS) {
      issues.push(`P3 hors barème (${fmt(session.scorePart3)} / max ${max3})`);
    }
    if (Math.abs(round2(session.totalScore) - sum) > EPS) {
      issues.push(
        `totalScore ${fmt(session.totalScore)} != somme des parts ${fmt(sum)}`,
      );
    }
    if (isCorrected(session.status)) {
      if (session.finalScore <= 0) {
        issues.push('corrigée sans finalScore (> 0)');
      } else if (Math.abs(round2(session.finalScore) - expectedFinal) > EPS) {
        issues.push(
          `finalScore ${fmt(session.finalScore)} != attendu ${fmt(expectedFinal)}`,
        );
      }
    }

    if (issues.length > 0) {
      anomalyCount += issues.length;
      anomaliesBySession.push(
        `⚠ [${session.id.slice(0, 8)}] ${session.candidate.name ?? 'candidat inconnu'} ` +
          `(${session.candidate.email ?? 'sans email'}) — statut ${session.status}\n` +
          issues.map((issue) => `    - ${issue}`).join('\n'),
      );
    }
  }

  console.log('\n── Anomalies ──');
  if (anomaliesBySession.length === 0) {
    console.log('Aucune anomalie détectée.');
  } else {
    console.log(anomaliesBySession.join('\n'));
  }

  console.log('\n── Résumé ──');
  console.log(
    `Sessions : ${sessions.length} | anomalies : ${anomalyCount} ` +
      `| sessions concernées : ${anomaliesBySession.length}`,
  );
  console.log('Audit terminé (aucune écriture).');
}

main()
  .catch(async (error: unknown) => {
    console.error('❌ Erreur durant l\'audit :', error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
