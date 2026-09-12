import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  round2,
  isCorrected,
  resolveExamMax,
  computeFinalScore,
  isPassed,
} from "@/lib/exams/scoring";

interface CustomBareme {
  totalMax?: number;
  maxPart1?: number;
  maxPart2?: number;
  maxPart3?: number;
}

interface ExamResult {
  id: string;
  examId: string;
  examName: string;
  examDescription?: string | null;
  status: string;
  passingScore: number;
  scorePart1: number | null;
  scorePart2: number | null;
  scorePart3: number | null;
  totalScore: number | null;
  maxScore: number;
  scorePercent: number | null;
  maxPart1: number;
  maxPart2: number;
  maxPart3: number;
  passed: boolean | null;
  internshipScore: number | null;
  completedAt: Date | string | null;
  submittedAt: Date | string | null;
  showResults: boolean;
}

export async function GET(request: Request) {
  try {
    const userAuth = await getCurrentUser(request);
    if (!userAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = userAuth.id;

    const submissions = await prisma.examSession.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        examId: true,
        totalScore: true,
        scorePart1: true,
        scorePart2: true,
        scorePart3: true,
        internshipScore: true,
        finalScore: true,
        status: true,
        gradedAt: true,
        submittedAt: true,
        answers: true,
        exam: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            passingScore: true,
            totalPoints: true,
            part1Points: true,
            part2Points: true,
            part3Points: true,
            part1Enabled: true,
            part2Enabled: true,
            part3Enabled: true,
            showResults: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const scored = submissions.map((sub) => {
      // Barème personnalisé éventuel stocké au niveau de la session
      const answers = sub.answers as { _customBareme?: CustomBareme } | null;
      const customBareme = answers?._customBareme ?? null;

      const maxPart1 = customBareme?.maxPart1 ?? sub.exam?.part1Points ?? 20;
      const maxPart2 = customBareme?.maxPart2 ?? sub.exam?.part2Points ?? 40;
      const maxPart3 = customBareme?.maxPart3 ?? sub.exam?.part3Points ?? 40;
      const maxScore = customBareme?.totalMax ?? resolveExamMax(sub.exam ?? {});

      const isDone = isCorrected(sub.status);
      const hasFinalScore =
        typeof sub.finalScore === "number" &&
        Number.isFinite(sub.finalScore) &&
        sub.finalScore > 0;

      // finalScore = pourcentage 0..100 ; fallback calculé sur les points bruts.
      const finalScore = isDone
        ? hasFinalScore
          ? round2(sub.finalScore)
          : computeFinalScore(sub.totalScore, maxScore)
        : null;

      const showResults = sub.exam?.showResults !== false;
      const gradesVisible = isDone && showResults;

      return {
        sub,
        customBareme,
        maxPart1,
        maxPart2,
        maxPart3,
        maxScore,
        isDone,
        finalScore,
        showResults,
        gradesVisible,
      };
    });

    const results: ExamResult[] = scored.map((entry) => {
      const { sub, isDone, finalScore, gradesVisible, showResults } = entry;
      const passingScore = sub.exam?.passingScore ?? 65;

      return {
        id: sub.id,
        examId: sub.examId,
        examName: sub.exam?.name || "Examen",
        examDescription: sub.exam?.description,
        status: sub.status,
        type: sub.exam?.type || "OFFICIAL",
        passingScore,
        scorePart1: gradesVisible ? sub.scorePart1 : null,
        scorePart2: gradesVisible ? sub.scorePart2 : null,
        scorePart3: gradesVisible ? sub.scorePart3 : null,
        internshipScore: gradesVisible ? sub.internshipScore : null,
        finalScore: gradesVisible ? finalScore : null,
        totalScore: gradesVisible ? sub.totalScore : null,
        maxScore: entry.maxScore,
        scorePercent: gradesVisible ? finalScore : null,
        maxPart1: entry.maxPart1,
        maxPart2: entry.maxPart2,
        maxPart3: entry.maxPart3,
        passed: gradesVisible
          ? isDone && finalScore !== null && isPassed(finalScore, passingScore)
          : null,
        completedAt: sub.gradedAt || sub.submittedAt,
        submittedAt: sub.submittedAt,
        showResults,
      };
    });

    const corrected = scored.filter((entry) => entry.isDone);
    const stats = {
      totalExams: results.length,
      correctedExams: corrected.length,
      passedExams: corrected.filter((entry) =>
        isPassed(entry.finalScore ?? 0, entry.sub.exam?.passingScore),
      ).length,
      failedExams: corrected.filter(
        (entry) =>
          !isPassed(entry.finalScore ?? 0, entry.sub.exam?.passingScore),
      ).length,
      pendingReview: results.filter((r) => r.status === "PENDING_REVIEW").length,
      averageScore:
        corrected.length > 0
          ? Math.round(
              corrected.reduce(
                (sum, entry) => sum + (entry.finalScore ?? 0),
                0,
              ) / corrected.length,
            )
          : 0,
      bestScore:
        corrected.length > 0
          ? Math.max(...corrected.map((entry) => entry.finalScore ?? 0))
          : 0,
    };

    return NextResponse.json({ results, stats });
  } catch (error: unknown) {
    console.error("Erreur résultats user:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des résultats" },
      { status: 500 },
    );
  }
}
