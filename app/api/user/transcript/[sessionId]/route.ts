import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { sessionId } = await params;

  try {
    const examSession = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        exam: { select: { title: true } },
        candidate: { select: { name: true } }
      }
    });

    if (!examSession || examSession.userId !== user.id) {
      return NextResponse.json({ error: 'Résultat non trouvé ou non autorisé' }, { status: 403 });
    }

    if (examSession.status !== 'GRADED') {
        return NextResponse.json({ error: 'Le relevé est en cours de correction' }, { status: 400 });
    }

    // Trouver la formation liée via l'utilisateur
    const userData = await prisma.user.findUnique({
        where: { id: user.id },
        include: { formation: { select: { name: true } } }
    });

    // Extraction du barème dynamique
    const answers = (examSession.answers as any) || {};
    const custom = answers._customBareme || {};

    return NextResponse.json({
      id: examSession.id,
      fullName: examSession.candidate?.name || user.name || "Candidat",
      formationName: userData?.formation?.name || "Formation Professionnelle",
      sessionName: examSession.exam?.title || "Session Standard",
      scorePart1: examSession.scorePart1,
      scorePart2: examSession.scorePart2,
      scorePart3: examSession.scorePart3,
      maxPart1: custom.maxPart1 || 20,
      maxPart2: custom.maxPart2 || 40,
      maxPart3: custom.maxPart3 || 40,
      totalScore: examSession.totalScore,
      status: examSession.status,
      issuedAt: examSession.submittedAt || examSession.updatedAt
    });
  } catch (error) {
    console.error("Erreur Relevé de Notes (User) API:", error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
