// app/api/exams/[id]/submit/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { applyRateLimitByUser } from '@/lib/rate-limit';
import { analyzeAnswerPattern, logCheatingDetection } from '@/lib/anti-cheat';
import { createAuditLog } from '@/lib/audit';
import { pusherServer } from '@/lib/pusher';
import {
  computeFinalScore,
  computePart1Score,
  isPassed,
  resolveExamMaxFromParts,
  round2,
} from '@/lib/exams/scoring';
import { issueExamAttestation } from '@/lib/attestations/issue';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // ✅ ANTI-CHEAT: Per-user rate limiting (Re-enabled)
    const rateLimit = await applyRateLimitByUser(request, user.id, 'submission');
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { id: examId } = await params;
    const body = await request.json();
    const { answers } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Réponses manquantes ou invalides' }, { status: 400 });
    }

    // Fetch session to get server-side startedAt (anti-cheat: never trust client clock)
    const existingSession = await prisma.examSession.findFirst({
      where: { examId, userId: user.id },
      select: { startedAt: true, status: true },
    });

    // Early exit if already submitted (fast path before any heavy queries)
    if (existingSession?.status && !['IN_PROGRESS', 'PENDING'].includes(existingSession.status)) {
      return NextResponse.json({ error: 'Session déjà soumise' }, { status: 409 });
    }

    // ANTI-CHEAT: Time check using DB startedAt (not client-supplied value)
    if (existingSession?.startedAt) {
      const timeTakenMinutes = (Date.now() - existingSession.startedAt.getTime()) / 60000;
      if (timeTakenMinutes < 1) {
        await logCheatingDetection(user.id, examId, request.headers.get('x-forwarded-for') || 'unknown', request.headers.get('user-agent') || 'unknown', {
          isSuspicious: true,
          confidence: 'HIGH',
          flags: [{
            type: 'RAPID_SUBMISSION',
            severity: 'HIGH',
            details: `Soumission extrêmement rapide : ${timeTakenMinutes.toFixed(2)} minutes`
          }]
        });
      }
    }

    // ✅ Only fetch QCM part questions needed for scoring (not full exam)
    const qcmPart = await prisma.examPart.findFirst({
      where: {
        examId,
        type: 'QCM',
      },
      orderBy: { order: 'asc' },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: {
              select: { id: true, isCorrect: true }, // Only needed fields
            }
          }
        }
      }
    });

    // Full exam config: source of truth for the scoring scale.
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
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Examen non trouvé' }, { status: 404 });
    }

    // #119 — Contrainte serveur de durée : rejeter si le délai est dépassé.
    // Le chrono client n'a aucune autorité ; seule la date serveur compte.
    if (existingSession?.startedAt && exam.duration > 0) {
      const deadlineMs =
        existingSession.startedAt.getTime() + exam.duration * 1000;
      const toleranceMs = 60_000; // tolérance réseau / horloge raisonnable
      if (Date.now() > deadlineMs + toleranceMs) {
        return NextResponse.json(
          { error: 'Temps écoulé : la durée de l\'examen est dépassée' },
          { status: 400 },
        );
      }
    }

    // Calculate Part 1 score BEFORE the update (we have all needed data)
    let scorePart1 = 0;
    if (qcmPart) {
      let correctAnswersCount = 0;

      interface ExamPartWithQuestions {
        questions: {
          id: string;
          options: { id: string; isCorrect: boolean }[];
        }[];
      }

      const qcm = qcmPart as unknown as ExamPartWithQuestions; // Cast to access included relations
      const totalQuestions = qcm.questions.length;

      for (const q of qcm.questions) {
        const userAnswer: unknown = answers[q.id];
        const correctIds = q.options
          .filter((o) => o.isCorrect)
          .map((o) => o.id);

        if (Array.isArray(userAnswer)) {
          // MULTIPLE_CHOICE: the selected set must exactly match the correct set.
          const userSet = new Set(
            userAnswer.map((answer: unknown) => String(answer)),
          );
          if (
            correctIds.length > 0 &&
            correctIds.length === userSet.size &&
            correctIds.every((correctId) => userSet.has(correctId))
          ) {
            correctAnswersCount++;
          }
        } else {
          const correctOption = q.options.find((o) => o.isCorrect);
          if (correctOption && userAnswer === correctOption.id) {
            correctAnswersCount++;
          }
        }
      }

      scorePart1 = computePart1Score(
        correctAnswersCount,
        totalQuestions,
        qcmPart.points || 20,
      );
    }

    // ✅ Detect if exam has manual grading parts (Part 2/3+, OPEN or CASE_STUDY)
    const allExamParts = await prisma.examPart.findMany({
      where: { examId },
      select: { order: true, type: true, points: true }
    });
    const hasManualGrading = allExamParts.some(
      (p: { order: number; type: string }) =>
        p.order > 1 || p.type === 'OPEN' || p.type === 'CASE_STUDY',
    );
    const finalStatus = hasManualGrading ? 'PENDING_REVIEW' : 'COMPLETED';

    // Canonical scale: scorePartN = raw points, totalScore = raw sum,
    // finalScore = percentage (only meaningful once fully corrected).
    // Max dérivé des ExamPart réels (pas des champs legacy partNPoints).
    const totalPoints = resolveExamMaxFromParts(allExamParts, exam);
    const roundedPart1 = round2(scorePart1);
    const finalScore =
      finalStatus === 'COMPLETED'
        ? computeFinalScore(roundedPart1, totalPoints)
        : 0;

    // ✅ Atomic update: only succeeds if session is still submittable
    const result = await prisma.examSession.updateMany({
      where: {
        examId,
        userId: user.id,
        status: { in: ['IN_PROGRESS', 'PENDING'] },
      },
      data: {
        status: finalStatus,
        submittedAt: new Date(),
        answers: answers,
        scorePart1: roundedPart1,
        score: roundedPart1, // legacy alias = Part 1 raw score
        scorePart2: null, // sentinelle « non corrigé » — noté par l'admin
        scorePart3: null, // sentinelle « non corrigé » — noté par l'admin
        totalScore: roundedPart1,
        finalScore,
      },
    });

    // If count is 0, another request already completed this submission
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Session déjà soumise' },
        { status: 409 }
      );
    }

    // Enregistrer le log d'audit
    await createAuditLog({
      userId: user.id,
      action: 'EXAM_SUBMITTED',
      resource: 'EXAM',
      resourceId: examId,
      newValue: { status: finalStatus, scorePart1: roundedPart1, finalScore },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown"
    });

    // ✅ ANTI-CHEAT: Analyze answer patterns (Re-enabled)
    try {
      const detection = await analyzeAnswerPattern(answers, examId, user.id);
      
      if (detection.isSuspicious) {
        await logCheatingDetection(
          user.id,
          examId,
          request.headers.get('x-forwarded-for') || 'unknown',
          request.headers.get('user-agent') || 'unknown',
          detection
        );
      }
    } catch (error) {
      console.error('[ANTI-CHEAT ERROR]', error);
    }

    // Fetch the updated session for the response
    const updatedSession = await prisma.examSession.findFirst({
      where: { examId, userId: user.id },
      select: {
        id: true,
        status: true,
        scorePart1: true,
        totalScore: true,
        finalScore: true,
      },
    });

    // Attestation automatique : examen officiel, entièrement corrigé et réussi.
    // Non bloquant — issueExamAttestation ne throw jamais.
    if (
      finalStatus === 'COMPLETED' &&
      isPassed(finalScore, exam.passingScore) &&
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

    const response = {
      message: 'Examen soumis avec succès',
      submissionId: updatedSession?.id,
      scorePart1: updatedSession?.scorePart1,
      totalScore: updatedSession?.totalScore,
      finalScore: updatedSession?.finalScore ?? finalScore,
      maxScore: totalPoints,
      status: finalStatus,
    };

    // Déclenchement Pusher pour l'admin (non-bloquant)
    try {
        await pusherServer.trigger('admin-updates', 'new-submission', {
            candidateName: user.name,
            examId: examId,
            status: finalStatus,
            timestamp: new Date().toISOString()
        });
    } catch (pushError) {
        console.error('[PUSHER_ERROR] Failed to notify admin:', pushError);
    }

    return NextResponse.json(response, { status: 201 });

  } catch (error: unknown) {
    console.error('[EXAM_SUBMIT_ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur', details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
