import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const { id } = params;

    const submission = await prisma.examSession.findUnique({
      where: { id },
      include: {
        candidate: true,
        scans: true, // Inclusion des scans pour la correction physique
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
      return NextResponse.json({ message: "Soumission non trouvée" }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[GET_SUBMISSION ERROR]", error);
    return NextResponse.json({ message: "Erreur lors de la récupération de la soumission" }, { status: 500 });
  }
}
