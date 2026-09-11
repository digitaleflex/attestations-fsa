import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { isPassed, resolveExamMax } from "@/lib/exams/scoring";

// GET /api/admin/submissions - Récupérer toutes les soumissions
export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Non autorisé - Admin requis" },
        { status: 401 },
      );
    }

    const rawSubmissions = await prisma.examSession.findMany({
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        exam: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
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
      },
      orderBy: { startedAt: "desc" },
    });

    // Champs calculés par soumission (format tableau conservé).
    const submissions = rawSubmissions.map((sub) => {
      const maxScore = resolveExamMax(sub.exam);
      const passed =
        sub.status === "GRADED" &&
        isPassed(sub.finalScore, sub.exam.passingScore);

      return {
        ...sub,
        maxScore,
        passed,
        completed: sub.status === "GRADED",
        pendingReview: sub.status === "PENDING_REVIEW",
      };
    });

    // Statistiques
    const stats = {
      total: submissions.length,
      pendingReview: submissions.filter((s) => s.status === "PENDING_REVIEW")
        .length,
      inProgress: submissions.filter((s) => s.status === "IN_PROGRESS").length,
      completed: submissions.filter((s) => s.status === "GRADED").length,
      passed: submissions.filter((s) => s.passed).length,
    };

    return NextResponse.json({
      submissions,
      stats,
    });
  } catch (error: unknown) {
    console.error("Erreur soumissions admin:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des soumissions",
      },
      { status: 500 },
    );
  }
}
