import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * POST /api/exams/[id]/submit
 * Soumet les réponses d'un candidat et calcule le score de la partie 1 (QCM)
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
    const { answers } = body; // Map { [questionId]: optionId | text }

    if (!answers) {
      return NextResponse.json({ error: 'Réponses manquantes' }, { status: 400 });
    }

    // 1. Vérifier si l'examen existe et si une session est en cours
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        parts: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: true
              }
            }
          }
        }
      }
    });

    if (!exam) {
      return NextResponse.json({ error: 'Examen non trouvé' }, { status: 404 });
    }

    const session = await prisma.examSession.findFirst({
      where: {
        examId,
        userId: user.id,
      }
    });

    if (!session || (session.status !== 'IN_PROGRESS' && session.status !== 'PENDING')) {
      return NextResponse.json({ 
        error: 'Session non trouvée ou déjà soumise',
        status: session?.status 
      }, { status: 400 });
    }

    // 2. Calculer le score de la Partie 1 (QCM)
    const part1 = exam.parts.find(p => p.order === 1 || p.type === 'QCM');
    let scorePart1 = 0;
    let totalPart1Points = part1?.points || 20;

    if (part1) {
      let correctAnswersCount = 0;
      const questionsPart1 = part1.questions;
      
      questionsPart1.forEach(q => {
        const userAnswerId = answers[q.id];
        const correctOption = q.options.find(o => o.isCorrect);
        
        if (correctOption && userAnswerId === correctOption.id) {
          correctAnswersCount++;
        }
      });

      // Calculer le score au prorata des points de la partie 1
      if (questionsPart1.length > 0) {
          scorePart1 = (correctAnswersCount / questionsPart1.length) * totalPart1Points;
      }
    }

    // 3. Mettre à jour la session avec les notes et réponses
    // Note: Le score final sera consolidé après correction de la partie 2 & 3 par l'admin
    const updatedSession = await prisma.examSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        submittedAt: new Date(),
        answers: answers as any, // On stocke toutes les réponses (ID des options QCM et texte des questions ouvertes)
        scorePart1: scorePart1,
        scorePart2: 0, // À grader par l'admin
        scorePart3: 0, // À grader par l'admin
        totalScore: scorePart1, // Incomplet mais premier score brut
      }
    });

    // 4. (Facultatif) Déclencher des actions de suivi (ex : notification admin)

    return NextResponse.json({
      message: 'Examen soumis avec succès',
      submissionId: updatedSession.id,
      scorePart1: scorePart1,
      totalScore: scorePart1,
      status: 'COMPLETED'
    }, { status: 201 });

  } catch (error) {
    console.error('[EXAM_SUBMIT_ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
