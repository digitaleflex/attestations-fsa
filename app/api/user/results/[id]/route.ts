import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const userId = userSession.id;

    const { id } = await params;

    const submission = await prisma.examSession.findUnique({
      where: { id },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            part1Points: true,
            part2Points: true,
            part3Points: true,
            totalPoints: true,
            passingScore: true,
            type: true,
            name: true, // legacy field probably
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
