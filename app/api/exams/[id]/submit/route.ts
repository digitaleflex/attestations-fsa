// app/api/exams/[id]/submit/route.ts
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAdminUser, getCurrentUser } from '@/lib/auth';
import { applyRateLimitByUser } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import {
  calculateCanonicalScore,
  computePart1Score,
  createScoringSnapshot,
  isPassed,
  isSubmittableStatus,
  round2,
  withScoringSnapshot,
} from '@/lib/exams/scoring';
import { issueExamAttestation } from '@/lib/attestations/issue';
import {
  checkExamEligibility,
  enrollmentForbiddenResponse,
} from '@/lib/exams/eligibility';
import { deleteDraft } from '@/lib/exam-draft';
import { hasOpened, lockedPayload } from '@/lib/exams/time';

const MAX_ANSWERS_BYTES = 1_000_000;
const MAX_ANSWER_ENTRIES = 1_000;
const MAX_TEXT_LENGTH = 20_000;
const MAX_SELECTED_OPTIONS = 100;

type AnswerValue = string | string[];
type AnswerMap = Record<string, AnswerValue>;

type ScoredPart = {
  id: string;
  type: string;
  points: number;
  questions: Array<{
    id: string;
    type: string;
    options: Array<{ id: string; isCorrect: boolean }>;
  }>;
};

function validateAnswers(
  value: unknown,
  parts: ScoredPart[],
): AnswerMap | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return null;
  }
  if (
    Buffer.byteLength(serialized, 'utf8') > MAX_ANSWERS_BYTES ||
    Object.keys(value).length > MAX_ANSWER_ENTRIES
  ) {
    return null;
  }

  const questions = new Map(
    parts.flatMap((part) =>
      part.questions.map((question) => [question.id, { part, question }] as const),
    ),
  );
  const hasOpenPart = parts.some((part) => part.type === 'OPEN');
  const hasCaseStudy = parts.some((part) => part.type === 'CASE_STUDY');
  const answers: AnswerMap = {};

  for (const [key, answer] of Object.entries(value)) {
    if (key === 'part2' && hasOpenPart) {
      if (typeof answer !== 'string' || answer.length > MAX_TEXT_LENGTH) return null;
      answers[key] = answer;
      continue;
    }
    if (key === 'part3' && hasCaseStudy) {
      if (typeof answer !== 'string' || answer.length > MAX_TEXT_LENGTH) return null;
      answers[key] = answer;
      continue;
    }

    const found = questions.get(key);
    if (!found) return null;
    const { part, question } = found;
    if (part.type === 'OPEN') {
      if (typeof answer !== 'string' || answer.length > MAX_TEXT_LENGTH) return null;
      answers[key] = answer;
      continue;
    }
    if (question.type === 'MULTIPLE_CHOICE') {
      if (
        !Array.isArray(answer) ||
        answer.length > MAX_SELECTED_OPTIONS ||
        answer.some((id) => typeof id !== 'string') ||
        new Set(answer).size !== answer.length
      ) {
        return null;
      }
    } else if (typeof answer !== 'string') {
      return null;
    }
    if (typeof answer === 'string' && answer.length > 200) return null;

    const optionIds = new Set(question.options.map((option) => option.id));
    const selected = Array.isArray(answer) ? answer : [answer];
    if (selected.some((id) => !optionIds.has(id))) return null;
    answers[key] = answer as AnswerValue;
  }

  return answers;
}

function autoGradeQcm(parts: ScoredPart[], answers: AnswerMap): number {
  return round2(
    parts
      .filter((part) => part.type === 'QCM')
      .reduce((partTotal, part) => {
        let correct = 0;
        for (const question of part.questions) {
          const answer = answers[question.id];
          const correctIds = new Set(
            question.options
              .filter((option) => option.isCorrect)
              .map((option) => option.id),
          );
          if (Array.isArray(answer)) {
            if (
              correctIds.size > 0 &&
              correctIds.size === answer.length &&
              answer.every((id) => correctIds.has(id))
            ) {
              correct++;
            }
          } else if (answer && correctIds.size === 1 && correctIds.has(answer)) {
            correct++;
          }
        }
        return partTotal + computePart1Score(correct, part.questions.length, part.points);
      }, 0),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const rateLimit = await applyRateLimitByUser(request, user.id, 'submission');
    if (!rateLimit.allowed) return rateLimit.response;

    const { id: examId } = await params;
    const body = await request.json();
    const rawAnswers = body?.answers;
    if (
      rawAnswers === null ||
      typeof rawAnswers !== 'object' ||
      Array.isArray(rawAnswers)
    ) {
      return NextResponse.json(
        { error: 'Réponses manquantes ou invalides' },
        { status: 400 },
      );
    }

    // #256 — l'éligibilité est vérifiée AVANT tout état de session : un
    // candidat non inscrit (ou révoqué) reçoit 403, pas 409 « session non
    // démarrée », et la route ne révèle ni l'existence d'une session ni son
    // statut. Aucune session n'est lue avant le contrôle d'accès. L'examen
    // n'est lu qu'une fois : le contrôle d'accès et la correction partagent le
    // même objet, donc aucun second aller-retour ni état divergent.
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        part1Points: true,
        part2Points: true,
        part3Points: true,
        part1Enabled: true,
        part2Enabled: true,
        part3Enabled: true,
        totalPoints: true,
        type: true,
        passingScore: true,
        formationId: true,
        duration: true,
        status: true,
        scheduledAt: true,
      },
    });
    if (!exam) {
      return NextResponse.json({ error: 'Examen non trouvé' }, { status: 404 });
    }

    // #256 m9 — un examen REVERROUILLÉ (archivé, repassé SCHEDULED avec une
    // échéance future, ou date d'ouverture retirée) refuse toute soumission :
    // 423 avant même le contrôle d'éligibilité, donc avant de révéler
    // l'existence d'une session. Seules métadonnées d'annonce en réponse.
    const now = new Date();
    if (!hasOpened(exam, now)) {
      return NextResponse.json(lockedPayload(exam, now), { status: 423 });
    }

    const adminUser = await getAdminUser(request);
    const eligibility = await checkExamEligibility({
      userId: user.id,
      examId: exam.id,
      examType: exam.type,
      isAdmin: adminUser !== null,
    });
    if (!eligibility.eligible) return enrollmentForbiddenResponse(eligibility);

    const existingSession = await prisma.examSession.findFirst({
      where: { examId, userId: user.id },
      select: { id: true, startedAt: true, status: true, submittedAt: true },
    });
    if (!existingSession) {
      return NextResponse.json(
        { error: 'Session d’examen non démarrée' },
        { status: 409 },
      );
    }
    if (
      !isSubmittableStatus(existingSession.status) ||
      existingSession.submittedAt !== null
    ) {
      return NextResponse.json({ error: 'Session déjà soumise' }, { status: 409 });
    }

    const [qcmPart, allExamParts] = await Promise.all([
      prisma.examPart.findFirst({
        where: { examId, type: 'QCM' },
        orderBy: { order: 'asc' },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { select: { id: true, isCorrect: true } } },
          },
        },
      }),
      prisma.examPart.findMany({
        where: { examId },
        orderBy: { order: 'asc' },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { select: { id: true, isCorrect: true } } },
          },
        },
      }),
    ]);

    const typedParts = (allExamParts as unknown as ScoredPart[]).map((part) => {
      const questions = part.questions ?? [];
      if (questions.length > 0 || !qcmPart) return { ...part, questions };
      return {
        ...part,
        points: part.points ?? qcmPart.points ?? exam.part1Points ?? 0,
        questions: qcmPart.questions ?? [],
      };
    });
    const answers = validateAnswers(rawAnswers, typedParts);
    if (!answers) {
      return NextResponse.json(
        { error: 'Réponses manquantes, invalides ou hors examen' },
        { status: 400 },
      );
    }

    if (exam.duration > 0) {
      const deadlineMs = existingSession.startedAt.getTime() + exam.duration * 1000;
      if (Date.now() > deadlineMs + 60_000) {
        return NextResponse.json(
          { error: 'Temps écoulé : la durée de l\'examen est dépassée' },
          { status: 400 },
        );
      }
    }

    const scorePart1 = autoGradeQcm(typedParts, answers);
    const hasManualGrading = typedParts.some((part) => part.type !== 'QCM');
    // Une session QCM-only est corrigée immédiatement. `GRADED` est l'état
    // canonique exigé par le hub d'attestation ; `COMPLETED` autorise encore
    // une nouvelle soumission et ne doit donc pas être assimilé à une
    // correction validée. Les sessions avec correction manuelle restent en
    // PENDING_REVIEW jusqu'au passage par l'endpoint admin.
    const finalStatus = hasManualGrading ? 'PENDING_REVIEW' : 'GRADED';
    const snapshot = createScoringSnapshot(typedParts, exam);
    const score = calculateCanonicalScore(
      snapshot,
      { part1: scorePart1, part2: null, part3: null },
      !hasManualGrading,
    );
    const persistedAnswers = withScoringSnapshot(answers, snapshot);

    const result = await prisma.examSession.updateMany({
      where: {
        id: existingSession.id,
        status: { in: ['IN_PROGRESS', 'PENDING'] },
        submittedAt: null,
      },
      data: {
        status: finalStatus,
        submittedAt: new Date(),
        gradedAt: hasManualGrading ? null : new Date(),
        answers: persistedAnswers as unknown as Prisma.InputJsonValue,
        scorePart1: score.scorePart1,
        score: score.scorePart1,
        scorePart2: null,
        scorePart3: null,
        totalScore: score.totalScore,
        finalScore: score.finalScore,
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Session déjà soumise' }, { status: 409 });
    }

    await deleteDraft(examId, user.id);
    await createAuditLog({
      userId: user.id,
      action: 'EXAM_SUBMITTED',
      resource: 'EXAM',
      resourceId: examId,
      newValue: {
        status: finalStatus,
        scorePart1: score.scorePart1,
        finalScore: score.finalScore,
        scoringVersion: snapshot.version,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    const updatedSession = await prisma.examSession.findFirst({
      where: { id: existingSession.id },
      select: {
        id: true,
        status: true,
        scorePart1: true,
        totalScore: true,
        finalScore: true,
      },
    });

    if (
      finalStatus === 'GRADED' &&
      isPassed(score.finalScore, exam.passingScore) &&
      exam.type === 'OFFICIAL' &&
      exam.formationId &&
      updatedSession?.id
    ) {
      try {
        await issueExamAttestation(updatedSession.id);
      } catch (attestationError) {
        console.error('[ATTESTATION_ISSUE_ERROR]', attestationError);
      }
    }

    return NextResponse.json({
      message: 'Examen soumis avec succès',
      submissionId: updatedSession?.id,
      scorePart1: updatedSession?.scorePart1,
      totalScore: updatedSession?.totalScore,
      finalScore: updatedSession?.finalScore ?? score.finalScore,
      maxScore: snapshot.totalMax,
      status: finalStatus,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[EXAM_SUBMIT_ERROR]', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
