import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

// GET /api/admin/submissions - Récupérer toutes les soumissions
export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Admin requis" },
        { status: 401 },
      );
    }

    const submissions = (await prisma.examSession.findMany({
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
          },
        },
      },
      orderBy: { startedAt: "desc" },
    })) as Array<{ status: string; score: number | null }>;

    // Statistiques
    const stats = {
      total: submissions.length,
      pendingReview: submissions.filter((s) => s.status === "PENDING_REVIEW")
        .length,
      inProgress: submissions.filter((s) => s.status === "IN_PROGRESS").length,
      completed: submissions.filter((s) => s.status === "COMPLETED").length,
      passed: submissions.filter(
        (s) => s.status === "COMPLETED" && (s.score || 0) >= 60,
      ).length,
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
