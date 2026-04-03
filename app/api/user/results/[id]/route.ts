import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Helper pour vérifier l'authentification user
async function isAuthenticatedUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  if (!session || !session.value) return null;
  return session.value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const submission = await prisma.examSession.findUnique({
      where: { id },
      include: {
        exam: {
          include: {
            parts: {
              include: {
                questions: {
                  include: {
                    options: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!submission) {
      return NextResponse.json({ message: "Résultat non trouvé" }, { status: 404 });
    }

    // Vérifier que ce résultat appartient bien à l'utilisateur connecté
    if (submission.userId !== userId) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[GET_USER_RESULT_ERROR]", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
