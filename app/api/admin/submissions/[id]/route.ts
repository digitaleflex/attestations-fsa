import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated, getAdminUser } from '@/lib/auth';

// GET /api/admin/submissions/[id] - Récupérer une soumission spécifique
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
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
        },
        scans: true
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Soumission non trouvée' }, { status: 404 });
    }

    // Formater les réponses (en fonction de la structure stockée dans le JSON answers)
    // On garde tel quel pour la compatibilité, mais on change qcmScore
    const formattedSubmission = {
      ...submission,
      qcmScore: submission.scorePart1 || 0,
    };

    return NextResponse.json(formattedSubmission);

  } catch (error: any) {
    console.error('Erreur soumission admin:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération de la soumission' 
    }, { status: 500 });
  }
}
