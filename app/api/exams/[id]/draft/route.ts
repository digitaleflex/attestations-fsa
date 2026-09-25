import { NextResponse } from 'next/server';
import { getAdminUser, getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  checkExamEligibility,
  enrollmentForbiddenResponse,
} from '@/lib/exams/eligibility';
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  isValidExamDraft,
} from '@/lib/exam-draft';

async function ensureEligible(request: Request, examId: string, userId: string) {
  const [adminUser, exam] = await Promise.all([
    getAdminUser(request),
    prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, type: true },
    }),
  ]);

  if (!exam) {
    return Response.json({ error: 'Examen non trouvé' }, { status: 404 });
  }

  const eligibility = await checkExamEligibility({
    userId,
    examId: exam.id,
    examType: exam.type,
    isAdmin: adminUser !== null,
  });
  return eligibility.eligible
    ? null
    : enrollmentForbiddenResponse(eligibility);
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

    const { id: examId } = await params;
    const forbidden = await ensureEligible(request, examId, user.id);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { answers, timeRemaining, currentPart } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Réponses manquantes ou invalides' }, { status: 400 });
    }

    const draft = {
      answers,
      timeRemaining: timeRemaining ?? 0,
      currentPart: currentPart ?? 1,
      lastSync: new Date().toISOString(),
    };
    if (
      (timeRemaining !== undefined && typeof timeRemaining !== 'number') ||
      (currentPart !== undefined && typeof currentPart !== 'number') ||
      !isValidExamDraft(draft)
    ) {
      return NextResponse.json(
        { error: 'Brouillon invalide ou trop volumineux' },
        { status: 400 },
      );
    }
    const saved = await saveDraft(examId, user.id, draft);

    return NextResponse.json({ saved });
  } catch (error) {
    console.error('[DRAFT SAVE ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id: examId } = await params;
    const forbidden = await ensureEligible(request, examId, user.id);
    if (forbidden) return forbidden;

    const draft = await loadDraft(examId, user.id);

    if (!draft) {
      return NextResponse.json({ draft: null });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[DRAFT LOAD ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id: examId } = await params;
    const forbidden = await ensureEligible(request, examId, user.id);
    if (forbidden) return forbidden;

    const deleted = await deleteDraft(examId, user.id);

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error('[DRAFT DELETE ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
