import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveDraft, loadDraft, deleteDraft } from '@/lib/exam-draft';

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
    const { answers, timeRemaining, currentPart } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Réponses manquantes ou invalides' }, { status: 400 });
    }

    const saved = await saveDraft(examId, user.id, {
      answers,
      timeRemaining: timeRemaining ?? 0,
      currentPart: currentPart ?? 1,
      lastSync: new Date().toISOString(),
    });

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
    const deleted = await deleteDraft(examId, user.id);

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error('[DRAFT DELETE ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
