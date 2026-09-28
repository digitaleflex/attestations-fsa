import { NextResponse } from 'next/server';
import { getAdminUser, getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyRateLimitByUser } from '@/lib/rate-limit';
import { hasOpened, lockedPayload } from '@/lib/exams/time';
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

/**
 * #256 — la synchronisation du brouillon était le point d'entrée le plus
 * sollicité du flux examen (toutes les 15 s côté client) et le seul sans
 * limite. La limite `examDraft` est calée au-dessus du rythme nominal afin de
 * ne jamais pénaliser un examen légitime, tout en bloquant une boucle.
 * Appliquée APRÈS l'authentification (clé par utilisateur) et AVANT tout
 * accès à l'examen : un candidat non inscrit ne consomme aucun quota.
 */
async function ensureDraftRateLimit(request: Request, userId: string) {
  const rateLimit = await applyRateLimitByUser(request, userId, 'examDraft');
  return rateLimit.allowed ? null : rateLimit.response;
}

/**
 * Contrôle d'accès commun aux trois verbes du brouillon.
 * Ordre des contrôles : existence (404) → ouverture jour J (423) → éligibilité
 * inscription (403). Le verrou est donc évalué AVANT l'éligibilité : un
 * candidat non inscrit sur un examen verrouillé n'apprend rien de plus qu'un
 * candidat inscrit.
 */
async function ensureEligible(request: Request, examId: string, userId: string) {
  const [adminUser, exam] = await Promise.all([
    getAdminUser(request),
    prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        type: true,
        status: true,
        scheduledAt: true,
        opensOn: true,
      },
    }),
  ]);

  if (!exam) {
    return Response.json({ error: 'Examen non trouvé' }, { status: 404 });
  }

  const now = new Date();
  if (!hasOpened(exam, now)) {
    return NextResponse.json(lockedPayload(exam, now), { status: 423 });
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

    const limited = await ensureDraftRateLimit(request, user.id);
    if (limited) return limited;

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

    const limited = await ensureDraftRateLimit(request, user.id);
    if (limited) return limited;

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

    const limited = await ensureDraftRateLimit(request, user.id);
    if (limited) return limited;

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
