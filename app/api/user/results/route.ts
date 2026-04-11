import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Helper local supprimé au profit de getCurrentUser unifié.

interface ExamResult {
  id: string;
  examId: string;
  examName: string;
  examDescription?: string | null;
  status: string;
  passingScore: number;
  scorePart1: number;
  scorePart2: number | null;
  scorePart3: number | null;
  totalScore: number;
  maxScore: number;
  scorePercent: number;
  maxPart1: number;
  maxPart2: number;
  maxPart3: number;
  passed: boolean;
  completedAt: Date | string | null;
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
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const results: ExamResult[] = submissions.map((sub: any) => {
      // Récupérer le barème personnalisé s'il existe
      const customBareme = sub.answers && typeof sub.answers === 'object' 
        ? (sub.answers as any)._customBareme 
        : null;

      const maxPart1 = customBareme?.maxPart1 ?? (sub.exam?.part1Points || 20);
      const maxPart2 = customBareme?.maxPart2 ?? (sub.exam?.part2Points || 40);
      const maxPart3 = customBareme?.maxPart3 ?? (sub.exam?.part3Points || 40);
      const maxScore = customBareme?.totalMax ?? (sub.exam?.totalPoints || 100);

      const scorePercent =
        maxScore > 0 ? Math.round((sub.totalScore / maxScore) * 100) : 0;
      const passingScore = sub.exam?.passingScore || 65;

      // Note finale : on utilise finalScore s'il existe (moyenne exam + stage), sinon le % exam
      const finalDisplayScore = sub.finalScore !== undefined && sub.finalScore !== null && sub.finalScore > 0
        ? sub.finalScore 
        : scorePercent;

      return {
        id: sub.id,
        examId: sub.examId,
        examName: sub.exam?.name || "Examen",
        examDescription: sub.exam?.description,
        status: sub.status,
        type: sub.exam?.type || "OFFICIAL",
        passingScore,
        scorePart1: sub.scorePart1,
        scorePart2: sub.scorePart2,
        scorePart3: sub.scorePart3,
        internshipScore: sub.internshipScore,
        finalScore: sub.finalScore,
        totalScore: sub.totalScore,
        maxScore,
        scorePercent: finalDisplayScore,
        maxPart1,
        maxPart2,
        maxPart3,
        passed: finalDisplayScore >= passingScore,
        completedAt: sub.gradedAt || sub.submittedAt,
      };
    });

    const stats = {
      totalExams: results.length,
      passedExams: results.filter((r) => r.passed).length,
      failedExams: results.filter((r) => !r.passed).length,
      averageScore:
        results.length > 0
          ? Math.round(
              results.reduce((sum, r) => sum + r.scorePercent, 0) /
                results.length,
            )
          : 0,
      bestScore:
        results.length > 0
          ? Math.max(...results.map((r) => r.scorePercent))
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
