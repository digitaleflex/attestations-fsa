/**
 * scripts/normalize-exam-scores.ts
 *
 * NORMALISATION NON DESTRUCTIVE des scores des ExamSession vers le barème
 * canonique :
 *   max        = answers._customBareme.totalMax (si présent et > 0)
 *                sinon resolveExamMax(exam)
 *   totalScore = round2(scorePart1 + scorePart2 + scorePart3)
 *   finalScore = préservé s'il est déjà > 0 (notes historiques incluant
 *                éventuellement la note de stage) ; sinon, pour une session
 *                corrigée : computeFinalScore(totalScore, max) ; sinon 0
 *   score      = round2(scorePart1)
 *
 * Le champ `status` n'est JAMAIS modifié.
 *
 * Mode par défaut : --dry-run (aucune écriture, affiche le diff).
 * Mode écriture    : --apply (AuditLog AVANT chaque update, en transaction).
 *
 * Usage :
 *   pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/normalize-exam-scores.ts
 *   pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/normalize-exam-scores.ts --apply
 */

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  round2,
  isCorrected,
  resolveExamMax,
  computeFinalScore,
} from '../lib/exams/scoring';

const prisma = new PrismaClient();

/** Tolérance de comparaison pour éviter le bruit flottant. */
const EPS = 0.009;

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

type SessionWithRefs = Prisma.ExamSessionGetPayload<{
  include: { exam: true; candidate: { select: { name: true; email: true } } };
}>;

/** Extrait `answers._customBareme` sans jamais utiliser `any`. */
function getCustomBareme(answers: unknown): CustomBareme | null {
  if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) {
    return null;
  }
  const record = answers as Record<string, unknown>;
  const raw = record._customBareme;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
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

/** Barème effectif d'une part (le `_customBareme` prime si présent). */
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

/** Sérialise une valeur en JSON acceptable par Prisma. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Acteur à créditer dans l'AuditLog (le schéma exige un `userId`).
 * `SCORE_NORMALIZED` est une action système : on prend le premier admin,
 * sinon le premier utilisateur. `null` => écriture impossible.
 */
async function resolveAuditActorId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (admin) return admin.id;

  const fallback = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = !apply;

  console.log('================================================================');
  console.log(' NORMALISATION DES SCORES — ExamSession');
  console.log(` Mode : ${dryRun ? 'DRY-RUN (aucune écriture)' : 'APPLY (écriture + traçabilité)'}`);
  console.log('================================================================');

  let actorId: string | null = null;
  if (apply) {
    actorId = await resolveAuditActorId();
    if (!actorId) {
      console.error(
        '❌ Aucun utilisateur disponible pour porter l\'AuditLog. Abandon en --apply.',
      );
      return;
    }
  }

  const sessions = await prisma.examSession.findMany({
    include: {
      exam: true,
      candidate: { select: { name: true, email: true } },
    },
    orderBy: { startedAt: 'asc' },
  });

  let scanned = 0;
  let updated = 0;
  let skippedOutOfBareme = 0;
  let skippedNoMax = 0;
  let unchanged = 0;

  for (const session of sessions) {
    scanned += 1;
    const exam = session.exam;
    const cb = getCustomBareme(session.answers);
    const max1 = effectivePartMax(exam, cb, 1);
    const max2 = effectivePartMax(exam, cb, 2);
    const max3 = effectivePartMax(exam, cb, 3);

    const p1 = session.scorePart1;
    const p2 = session.scorePart2;
    const p3 = session.scorePart3;
    const label = `[${session.id.slice(0, 8)}] ${session.candidate.name ?? 'candidat inconnu'}`;

    // Garde-fou : aucune part ne doit dépasser son barème.
    const outOfBareme =
      p1 < -EPS || p1 > max1 + EPS ||
      p2 < -EPS || p2 > max2 + EPS ||
      p3 < -EPS || p3 > max3 + EPS;
    if (outOfBareme) {
      skippedOutOfBareme += 1;
      console.log(
        `⏭️  ${label} — IGNORÉE (hors barème) : ` +
          `P1=${fmt(p1)}/${max1} P2=${fmt(p2)}/${max2} P3=${fmt(p3)}/${max3} → revue manuelle`,
      );
      continue;
    }

    // Le barème custom stocké prime sur le barème courant de l'examen :
    // des sessions historiques ont été notées sur un barème différent (ex. /20).
    const customTotal = cb?.totalMax;
    const max = customTotal && customTotal > 0 ? customTotal : resolveExamMax(exam);
    if (max <= 0) {
      skippedNoMax += 1;
      console.log(
        `⏭️  ${label} — IGNORÉE (barème invalide : max=${fmt(max)})`,
      );
      continue;
    }

    const total = round2(p1 + p2 + p3);
    const existingFinalScore = round2(session.finalScore);
    const corrected = isCorrected(session.status);
    // NON DESTRUCTIF : on préserve toute note finale déjà calculée (> 0),
    // car elle peut intégrer la note de stage (barème de certification).
    const finalScore = !corrected
      ? 0
      : existingFinalScore > 0
        ? existingFinalScore
        : computeFinalScore(total, max);
    const score = round2(p1);

    const changes: string[] = [];
    if (round2(session.totalScore) !== total) {
      changes.push(`totalScore ${fmt(session.totalScore)} → ${fmt(total)}`);
    }
    if (round2(session.finalScore) !== finalScore) {
      changes.push(`finalScore ${fmt(session.finalScore)} → ${fmt(finalScore)}`);
    }
    if (round2(session.score) !== score) {
      changes.push(`score ${fmt(session.score)} → ${fmt(score)}`);
    }

    if (changes.length === 0) {
      unchanged += 1;
      console.log(`✓  ${label} — inchangée`);
      continue;
    }

    updated += 1;
    console.log(`✏️  ${label} (statut ${session.status})`);
    for (const change of changes) console.log(`      ${change}`);

    if (!apply || !actorId) continue;

    const { exam: _exam, candidate: _candidate, ...oldScalars } = session;
    const newScalars = {
      ...oldScalars,
      totalScore: total,
      finalScore,
      score,
    };

    // AuditLog AVANT l'update, dans la même transaction.
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'SCORE_NORMALIZED',
          resource: 'ExamSession',
          resourceId: session.id,
          oldValue: toJson(oldScalars),
          newValue: toJson(newScalars),
        },
      });
      await tx.examSession.update({
        where: { id: session.id },
        data: { totalScore: total, finalScore, score },
      });
    });
  }

  console.log('\n── Résumé ──');
  console.log(`Scannées            : ${scanned}`);
  console.log(
    `${dryRun ? 'À mettre à jour' : 'Mises à jour'}     : ${updated}`,
  );
  console.log(`Ignorées (hors barème): ${skippedOutOfBareme}`);
  console.log(`Ignorées (barème nul) : ${skippedNoMax}`);
  console.log(`Inchangées          : ${unchanged}`);
  console.log(
    dryRun
      ? 'DRY-RUN terminé — aucune écriture.'
      : 'APPLY terminé — écritures et AuditLog commités.',
  );
}

main()
  .catch(async (error: unknown) => {
    console.error('❌ Erreur durant la normalisation :', error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
