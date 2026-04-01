import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session || !session.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const url = new URL(request.url);
    const examId = url.searchParams.get('examId');

    if (!examId) {
      return NextResponse.json({ message: "ID de l'examen manquant" }, { status: 400 });
    }

    const submission = await prisma.examSubmission.findFirst({
      where: {
        examId,
        userId: session.user.id
      },
      include: {
        exam: {
          include: {
            parts: true
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    if (!submission) {
      return NextResponse.json({ message: "Résultat non trouvé" }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[MY_RESULT ERROR]", error);
    return NextResponse.json({ message: "Erreur lors de la récupération du résultat" }, { status: 500 });
  }
}
