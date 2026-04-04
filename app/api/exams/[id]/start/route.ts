import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

/**
 * POST /api/exams/[id]/start
 * Démarre une session d'examen pour l'utilisateur connecté
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

    // 1. Vérifier si l'examen existe et est publié
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        status: true,
        duration: true,
      }
    });

    if (!exam || exam.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Examen non disponible' }, { status: 404 });
    }

    // 2. Vérifier si une session existe déjà
    const existingSession = await prisma.examSession.findFirst({
      where: {
        examId,
        userId: user.id,
      }
    });

    if (existingSession) {
      // Si déjà soumis, on ne peut pas recommencer
      if (existingSession.status === 'COMPLETED' || existingSession.status === 'GRADED') {
        return NextResponse.json({ 
          error: 'Examen déjà soumis',
          status: existingSession.status 
        }, { status: 400 });
      }

      // Calculer le temps restant
      const now = new Date();
      const startedAt = new Date(existingSession.startedAt);
      const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
      const remainingSeconds = Math.max(0, exam.duration - elapsedSeconds);

      return NextResponse.json({
        message: 'Session existante reprise',
        sessionId: existingSession.id,
        duration: remainingSeconds,
        status: existingSession.status
      });
    }

    // 3. Créer une nouvelle session
    const session = await prisma.examSession.create({
      data: {
        examId,
        userId: user.id,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      }
    });

    // Enregistrer le log d'audit
    await createAuditLog({
      userId: user.id,
      action: 'EXAM_STARTED',
      resource: 'EXAM',
      resourceId: examId,
      newValue: { sessionId: session.id, startedAt: session.startedAt },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown"
    });

    return NextResponse.json({
      message: 'Examen démarré',
      sessionId: session.id,
      duration: exam.duration,
      status: 'IN_PROGRESS'
    }, { status: 201 });

  } catch (error) {
    console.error('[EXAM_START_ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
