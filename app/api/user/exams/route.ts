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

// GET /api/user/exams - Récupérer les examens de l'utilisateur
export async function GET(request: Request) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }
    
    // Récupérer les paramètres de requête
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // available, in-progress, completed
    
    // Récupérer l'utilisateur pour avoir ses infos
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        birthDate: true,
      }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }
    
    // Récupérer les sessions d'examens du candidat
    const examSessions = await prisma.examSession.findMany({
      where: {
        candidateId: userId
      },
      include: {
        exam: {
          include: {
            questions: {
              include: {
                question: true
              }
            }
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });
    
    // Formater les données
    const exams = examSessions.map((session: any) => ({
      id: session.id,
      examId: session.examId,
      examName: session.exam?.name,
      examDescription: session.exam?.description,
      status: session.status,
      score: session.score,
      maxScore: session.maxScore,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      duration: session.duration,
      questionCount: session.exam?.questions?.length || 0,
    }));
    
    // Statistiques
    const stats = {
      total: exams.length,
      completed: exams.filter((e: any) => e.status === 'COMPLETED').length,
      inProgress: exams.filter((e: any) => e.status === 'IN_PROGRESS').length,
      available: exams.filter((e: any) => e.status === 'AVAILABLE').length,
      passed: exams.filter((e: any) => e.status === 'COMPLETED' && e.score >= 70).length,
    };
    
    return NextResponse.json({
      exams,
      stats
    });
    
  } catch (error: any) {
    console.error('Erreur examens user:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des examens' 
    }, { status: 500 });
  }
}
