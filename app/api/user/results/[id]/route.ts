import { NextResponse, NextRequest } from 'next/server';
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
}

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
            part1Enabled: true,
            part2Enabled: true,
            part3Enabled: true,
            totalPoints: true,
            passingScore: true,
            showResults: true,
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

    const answers = submission.answers as { _customBareme?: CustomBareme } | null;
    const customBareme = answers?._customBareme ?? null;

    const exam = submission.exam;
    const maxScore = customBareme?.totalMax ?? resolveExamMax(exam ?? {});
    const passingScore = exam?.passingScore ?? 65;

    const isDone = isCorrected(submission.status);
    const hasFinalScore =
      typeof submission.finalScore === "number" &&
      Number.isFinite(submission.finalScore) &&
      submission.finalScore > 0;

    // finalScore = pourcentage 0..100 ; fallback calculé sur les points bruts.
    const finalScoreValue = isDone
      ? hasFinalScore
        ? round2(submission.finalScore)
        : computeFinalScore(submission.totalScore, maxScore)
      : null;

    // showResults === false => on masque les notes détaillées mais on garde le statut.
    const showResults = exam?.showResults !== false;
    const gradesVisible = showResults;

    return NextResponse.json({
      ...submission,
      totalScore: gradesVisible ? submission.totalScore : null,
      finalScore: gradesVisible ? finalScoreValue : null,
      scorePart1: gradesVisible ? submission.scorePart1 : null,
      scorePart2: gradesVisible ? submission.scorePart2 : null,
      scorePart3: gradesVisible ? submission.scorePart3 : null,
      maxScore,
      passingScore,
      scorePercent: gradesVisible ? finalScoreValue : null,
      passed: gradesVisible
        ? isDone &&
          finalScoreValue !== null &&
          isPassed(finalScoreValue, passingScore)
        : null,
      submittedAt: submission.submittedAt,
      showResults,
    });
  } catch (error) {
    console.error("[GET_USER_RESULT_ERROR]", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
