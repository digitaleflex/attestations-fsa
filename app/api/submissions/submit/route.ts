import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session || !session.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { examId, answers } = body; // answers: { questionId: optionId | string }

    if (!examId || !answers) {
      return NextResponse.json({ message: "Données manquantes" }, { status: 400 });
    }

    // 1. Récupérer l'examen et ses questions de type QCM pour le calcul auto
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        parts: {
          where: { type: "QCM" },
          include: {
            questions: {
              include: {
                options: true
              }
            }
          }
        }
      }
    });

    if (!exam) {
      return NextResponse.json({ message: "Examen non trouvé" }, { status: 404 });
    }

    // 2. Calculer le score de la Partie 1 (QCM)
    // On suppose que la Partie 1 est toujours le QCM et vaut 20 points au total
    let scorePart1 = 0;
    const qcmPart = exam.parts.find(p => p.type === "QCM");
    
    if (qcmPart && qcmPart.questions.length > 0) {
      const pointsPerQuestion = 20 / qcmPart.questions.length;
      
      for (const question of qcmPart.questions) {
        const userAnswer = answers[question.id];
        const correctOption = question.options.find(o => o.isCorrect);
        
        if (correctOption && userAnswer === correctOption.id) {
          scorePart1 += pointsPerQuestion;
        }
      }
    }

    // 3. Créer la soumission
    // On stocke les réponses brutes (answers) dans un champ de métadonnées si besoin, 
    // ou on crée un modèle de réponse détaillé. Pour l'instant, on reste simple.
    const submission = await prisma.examSubmission.create({
      data: {
        examId,
        userId: session.user.id,
        status: "PENDING",
        scorePart1: Math.round(scorePart1 * 100) / 100, // Arrondi à 2 décimales
        scorePart2: 0,
        scorePart3: 0,
        totalScore: 0, // Sera calculé par l'admin à la fin
      }
    });

    return NextResponse.json({ 
      message: "Examen soumis avec succès", 
      submissionId: submission.id,
      scorePart1: submission.scorePart1
    });

  } catch (error) {
    console.error("[SUBMISSION ERROR]", error);
    return NextResponse.json({ message: "Erreur lors de la soumission" }, { status: 500 });
  }
}
