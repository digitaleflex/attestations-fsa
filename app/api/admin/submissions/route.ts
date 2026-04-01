import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Helper pour vérifier l'authentification admin
async function isAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  if (!session || !session.value) return null;
  if (role?.value !== 'ADMIN') return null;
  
  return session.value;
}

// GET /api/admin/submissions - Récupérer toutes les soumissions
export async function GET() {
  try {
    const adminId = await isAuthenticatedAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
    }

    const submissions = await prisma.examSession.findMany({
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        exam: {
          select: {
            id: true,
            name: true,
            description: true,
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    // Statistiques
    const stats = {
      total: submissions.length,
      pendingReview: submissions.filter((s: any) => s.status === 'PENDING_REVIEW').length,
      inProgress: submissions.filter((s: any) => s.status === 'IN_PROGRESS').length,
      completed: submissions.filter((s: any) => s.status === 'COMPLETED').length,
      passed: submissions.filter((s: any) => s.status === 'COMPLETED' && s.score >= 60).length,
    };

    return NextResponse.json({
      submissions,
      stats
    });

  } catch (error: any) {
    console.error('Erreur soumissions admin:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des soumissions' 
    }, { status: 500 });
  }
}
