// app/api/exams/[id]/submit/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { applyRateLimitByUser } from '@/lib/rate-limit';
import { analyzeAnswerPattern, logCheatingDetection } from '@/lib/anti-cheat';
import { createAuditLog } from '@/lib/audit';
import { pusherServer } from '@/lib/pusher';

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
        OR: [{ order: 1 }, { type: 'QCM' }],
      },
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

    // Verify exam exists
    const examExists = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, part1Points: true },
    });

    if (!examExists) {
      return NextResponse.json({ error: 'Examen non trouvé' }, { status: 404 });
    }

    // ✅ ATOMIC double-submit prevention
    // Single UPDATE ... WHERE status IN (...) query
    // If another request already completed this, count will be 0
    const totalPart1Points = examExists.part1Points || 20;

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
        const userAnswerId = answers[q.id];
        const correctOption = q.options.find((o: { id: string; isCorrect: boolean }) => o.isCorrect);
        if (correctOption && userAnswerId === correctOption.id) {
          correctAnswersCount++;
        }
      }

      if (totalQuestions > 0) {
        scorePart1 = (correctAnswersCount / totalQuestions) * totalPart1Points;
      }
    }

    // ✅ Detect if exam has manual grading parts (Part 2 or 3)
    const allExamParts = await prisma.examPart.findMany({
      where: { examId },
      select: { order: true, type: true }
    });
    const hasManualGrading = allExamParts.some((p: { order: number; type: string }) => p.order > 1);
    const finalStatus = hasManualGrading ? 'PENDING_REVIEW' : 'COMPLETED';

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
        scorePart1: Math.round(scorePart1 * 100) / 100,
        scorePart2: 0,
        scorePart3: 0,
        totalScore: Math.round(scorePart1 * 100) / 100,
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
      newValue: { status: finalStatus, scorePart1: Math.round(scorePart1 * 100) / 100 },
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
      select: { id: true, status: true, scorePart1: true, totalScore: true },
    });

    const response = {
      message: 'Examen soumis avec succès',
      submissionId: updatedSession?.id,
      scorePart1: updatedSession?.scorePart1,
      totalScore: updatedSession?.totalScore,
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
