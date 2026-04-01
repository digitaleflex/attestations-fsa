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

// GET /api/admin/submissions/[id] - Récupérer une soumission spécifique
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await isAuthenticatedAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
    }

    const { id } = await params;

    const submission = await prisma.examSession.findUnique({
      where: { id },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        exam: {
          include: {
            questions: {
              include: {
                question: true
              }
            }
          }
        },
        answers: true
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Soumission non trouvée' }, { status: 404 });
    }

    // Formater les réponses
    const formattedSubmission = {
      ...submission,
      answers: {
        part1: submission.answers?.filter((a: any) => a.part === 1),
        part2: submission.answers?.filter((a: any) => a.part === 2).map((a: any) => a.answerText),
        part3: submission.answers?.find((a: any) => a.part === 3)?.answerText,
      },
      qcmScore: submission.qcmScore || 0,
    };

    return NextResponse.json(formattedSubmission);

  } catch (error: any) {
    console.error('Erreur soumission admin:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération de la soumission' 
    }, { status: 500 });
  }
}
