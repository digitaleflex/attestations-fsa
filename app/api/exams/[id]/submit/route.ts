// app/api/exams/[id]/submit/route.ts
// Optimized exam submission with atomic double-submit prevention
// Supports 50+ concurrent candidates safely
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// In-memory idempotency cache (key -> timestamp)
// Prevents duplicate processing of the same request
const idempotencyCache = new Map<string, { response: any; timestamp: number }>();
const IDEMPOTENCY_TTL = 60_000; // 1 minute

/**
 * POST /api/exams/[id]/submit
 * Submits candidate answers and calculates Part 1 (QCM) score.
 * 
 * Optimizations for 50+ concurrent submissions:
 * 1. Atomic updateMany with WHERE status check (prevents double submit)
 * 2. Only fetches QCM questions needed for scoring (not full exam)
 * 3. Idempotency key support (prevents duplicate processing)
 * 4. Minimal data loaded per request
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id: examId } = await params;
    const body = await request.json();
    const { answers, idempotencyKey } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Réponses manquantes ou invalides' }, { status: 400 });
    }

    // ✅ Idempotency check: return cached response if same key seen recently
    if (idempotencyKey) {
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL) {
        return NextResponse.json(cached.response, { status: 200 });
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
      const qcm = qcmPart as any; // Cast to access included relations
      const totalQuestions = qcm.questions.length;

      for (const q of qcm.questions) {
        const userAnswerId = answers[q.id];
        const correctOption = q.options.find((o: any) => o.isCorrect);
        if (correctOption && userAnswerId === correctOption.id) {
          correctAnswersCount++;
        }
      }

      if (totalQuestions > 0) {
        scorePart1 = (correctAnswersCount / totalQuestions) * totalPart1Points;
      }
    }

    // ✅ Atomic update: only succeeds if session is still submittable
    const result = await prisma.examSession.updateMany({
      where: {
        examId,
        userId: user.id,
        status: { in: ['IN_PROGRESS', 'PENDING'] },
      },
      data: {
        status: 'COMPLETED',
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
      status: 'COMPLETED',
    };

    // ✅ Cache response for idempotency
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, { response, timestamp: Date.now() });
    }

    // Clean old cache entries
    if (idempotencyCache.size > 1000) {
      const now = Date.now();
      for (const [key, val] of idempotencyCache.entries()) {
        if (now - val.timestamp > IDEMPOTENCY_TTL) idempotencyCache.delete(key);
      }
    }

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('[EXAM_SUBMIT_ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
