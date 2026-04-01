import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Helper pour vérifier l'authentification user
async function isAuthenticatedUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  if (!session || !session.value) return null;
  if (role?.value !== 'USER') return null;
  
  return session.value;
}

// GET /api/user/results - Récupérer les résultats détaillés de l'utilisateur
export async function GET(request: Request) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }
    
    // Récupérer les sessions d'examens terminées
    const examSessions = await prisma.examSession.findMany({
      where: {
        candidateId: userId,
        status: 'COMPLETED'
      },
      include: {
        exam: {
          select: {
            id: true,
            name: true,
            description: true,
            passingScore: true,
          }
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                text: true,
                type: true,
                category: true,
              }
            },
            selectedAnswer: true
          }
        }
      },
      orderBy: { completedAt: 'desc' }
    });
    
    // Formater les résultats
    const results = examSessions.map((session: any) => {
      const totalQuestions = session.answers?.length || 0;
      const correctAnswers = session.answers?.filter((a: any) => a.isCorrect).length || 0;
      const scorePercent = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
      
      // Détails par catégorie
      const categoriesBreakdown: any = {};
      session.answers?.forEach((answer: any) => {
        const category = answer.question?.category || 'Autre';
        if (!categoriesBreakdown[category]) {
          categoriesBreakdown[category] = { total: 0, correct: 0 };
        }
        categoriesBreakdown[category].total++;
        if (answer.isCorrect) categoriesBreakdown[category].correct++;
      });
      
      return {
        id: session.id,
        examId: session.examId,
        examName: session.exam?.name,
        examDescription: session.exam?.description,
        passingScore: session.exam?.passingScore,
        score: session.score,
        maxScore: session.maxScore,
        scorePercent,
        correctAnswers,
        totalQuestions,
        passed: scorePercent >= (session.exam?.passingScore || 70),
        completedAt: session.completedAt,
        duration: session.duration,
        categoriesBreakdown,
        answers: session.answers?.map((answer: any) => ({
          questionId: answer.questionId,
          questionText: answer.question?.text,
          questionType: answer.question?.type,
          questionCategory: answer.question?.category,
          selectedAnswer: answer.selectedAnswer?.text,
          isCorrect: answer.isCorrect,
          points: answer.points,
        }))
      };
    });
    
    // Statistiques globales
    const stats = {
      totalExams: results.length,
      passedExams: results.filter((r: any) => r.passed).length,
      failedExams: results.filter((r: any) => !r.passed).length,
      averageScore: results.length > 0 
        ? Math.round(results.reduce((sum: number, r: any) => sum + r.scorePercent, 0) / results.length)
        : 0,
      bestScore: results.length > 0
        ? Math.max(...results.map((r: any) => r.scorePercent))
        : 0,
    };
    
    return NextResponse.json({
      results,
      stats
    });
    
  } catch (error: any) {
    console.error('Erreur résultats user:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des résultats' 
    }, { status: 500 });
  }
}
