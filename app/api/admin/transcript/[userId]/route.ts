import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { userId } = await params;

  try {
    // Trouver la session d'examen la plus récente pour cet utilisateur
    const examSession = await prisma.examSession.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      include: {
        exam: { select: { title: true } },
        candidate: { select: { name: true } }
      }
    });

    if (!examSession) {
      return NextResponse.json({ error: 'Aucun relevé de notes trouvé pour cet utilisateur' }, { status: 404 });
    }

    // Trouver la formation liée via l'utilisateur
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { formation: { select: { name: true } } }
    });

    return NextResponse.json({
      id: examSession.id,
      fullName: examSession.candidate?.name || "Candidat",
      formationName: user?.formation?.name || "Formation Professionnelle",
      sessionName: examSession.exam?.title || "Session Standard",
      scorePart1: examSession.scorePart1,
      scorePart2: examSession.scorePart2,
      scorePart3: examSession.scorePart3,
      totalScore: examSession.totalScore,
      status: examSession.status,
      issuedAt: examSession.submittedAt || examSession.updatedAt
    });
  } catch (error) {
    console.error("Erreur Relevé de Notes API:", error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
