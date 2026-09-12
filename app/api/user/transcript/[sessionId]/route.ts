import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  round2,
  isCorrected,
  resolveExamMax,
  computeFinalScore,
  isPassed,
} from '@/lib/exams/scoring';

interface CustomBareme {
  totalMax?: number;
  maxPart1?: number;
  maxPart2?: number;
  maxPart3?: number;
}

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
        exam: {
          select: {
            title: true,
            totalPoints: true,
            part1Points: true,
            part2Points: true,
            part3Points: true,
            part1Enabled: true,
            part2Enabled: true,
            part3Enabled: true,
            passingScore: true,
            showResults: true,
          },
        },
        candidate: { select: { name: true } }
      }
    });

    if (!examSession || examSession.userId !== user.id) {
      return NextResponse.json({ error: 'Résultat non trouvé ou non autorisé' }, { status: 403 });
    }

    const exam = examSession.exam;
    const isDone = isCorrected(examSession.status);

    if (!isDone) {
        return NextResponse.json({ error: 'Le relevé est en cours de correction' }, { status: 400 });
    }

    // Trouver la formation liée via l'utilisateur
    const userData = await prisma.user.findUnique({
        where: { id: user.id },
        include: { formation: { select: { name: true } } }
    });

    // Extraction du barème dynamique
    const rawAnswers = examSession.answers as { _customBareme?: CustomBareme } | null;
    const custom = rawAnswers?._customBareme ?? {};

    const maxScore = custom.totalMax ?? resolveExamMax(exam);
    const passingScore = exam.passingScore ?? 65;
    const hasFinalScore =
      typeof examSession.finalScore === "number" && examSession.finalScore > 0;

    // finalScore = pourcentage 0..100 ; fallback calculé sur les points bruts.
    const finalScore = hasFinalScore
      ? round2(examSession.finalScore)
      : computeFinalScore(examSession.totalScore, maxScore);

    // #122 — showResults : masquer les notes tant que l'examen ne les expose pas.
    const gradesVisible = exam.showResults !== false;

    return NextResponse.json({
      id: examSession.id,
      fullName: examSession.candidate?.name || user.name || "Candidat",
      formationName: userData?.formation?.name || "Formation Professionnelle",
      sessionName: examSession.exam?.title || "Session Standard",
      scorePart1: gradesVisible ? examSession.scorePart1 : null,
      scorePart2: gradesVisible ? examSession.scorePart2 : null,
      scorePart3: gradesVisible ? examSession.scorePart3 : null,
      maxPart1: custom.maxPart1 ?? exam.part1Points ?? 20,
      maxPart2: custom.maxPart2 ?? exam.part2Points ?? 40,
      maxPart3: custom.maxPart3 ?? exam.part3Points ?? 40,
      totalScore: gradesVisible ? examSession.totalScore : null,
      maxScore,
      totalPoints: maxScore,
      finalScore: gradesVisible ? finalScore : null,
      passingScore,
      passed: gradesVisible ? isPassed(finalScore, passingScore) : null,
      status: examSession.status,
      issuedAt: examSession.submittedAt || examSession.updatedAt
    });
  } catch (error) {
    console.error("Erreur Relevé de Notes (User) API:", error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
