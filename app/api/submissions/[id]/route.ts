// app/api/submissions/[id]/route.ts
// Récupération d'une soumission individuelle (admin uniquement)
// ✅ FIX: Standardisation du format de réponse d'erreur
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { handleApiError } from '@/lib/error-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const submission = await prisma.examSession.findUnique({
      where: { id },
      include: {
        candidate: true,
        scans: true,
        exam: {
          include: {
            parts: {
              include: {
                questions: true
              }
            }
          }
        }
      }
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Soumission non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json(submission);
  } catch (error: any) {
    console.error("[GET_SUBMISSION ERROR]", error);
    return handleApiError(error, {
      route: '/api/submissions/[id]',
      operation: 'get_submission',
    });
  }
}
