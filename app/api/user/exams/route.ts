import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";

// Schéma de validation pour les examens
const ExamsQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['OFFICIAL', 'MOCK']).optional(),
  limit: z.coerce.number().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  try {
    const userAuth = await getCurrentUser(request);
    if (!userAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = userAuth.id;

    const { searchParams } = new URL(request.url);
    const params = ExamsQuerySchema.safeParse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      type: (searchParams.get("type") as any) || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    if (!params.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", details: params.error.format() },
        { status: 400 },
      );
    }

    // Requêtes PARALLÈLES (Gain de temps massif)
    const [user, availableExams, submissions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { examId: true },
      }),
      prisma.exam.findMany({
        where: {
          status: "PUBLISHED",
          type: params.data.type || undefined,
          // On pourrait ajouter des filtres ici basés sur params.data
        },
        select: {
          id: true,
          title: true,
          name: true,
          description: true,
          totalPoints: true,
          passingScore: true,
          duration: true,
          part1Questions: true,
          part2Questions: true,
          part3Enabled: true,
          type: true,
        },
        ...(params.data.limit ? { take: params.data.limit } : {}),
      }),
      prisma.examSession.findMany({
        where: { 
          userId,
          exam: {
            type: params.data.type || undefined
          }
        },
        select: {
          id: true,
          examId: true,
          totalScore: true,
          submittedAt: true,
          status: true,
          exam: {
            select: {
              title: true,
              name: true,
              description: true,
              totalPoints: true,
              passingScore: true,
              duration: true,
              part1Questions: true,
              part2Questions: true,
              part3Enabled: true,
              type: true,
            },
          },
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 },
      );
    }

    // Formater les données pour le Frontend
    const submittedExamIds = new Set(
      submissions.map((s: { examId: string }) => s.examId),
    );

    // 1. Ajouter les examens complétés
    const completedExams = submissions.map((sub: any) => {
      const exam = sub.exam;
      const qCount =
        exam.part1Questions + exam.part2Questions + (exam.part3Enabled ? 1 : 0);
      return {
        id: sub.examId,
        submissionId: sub.id,
        examName: exam.title || exam.name,
        examDescription: exam.description,
        status: sub.status === "GRADED" ? "COMPLETED" : "IN_PROGRESS",
        score: sub.totalScore,
        maxScore: exam.totalPoints || 100,
        passingScore: exam.passingScore || 65,
        startedAt: sub.submittedAt,
        completedAt: sub.submittedAt,
        duration: `${Math.round(exam.duration / 60)} minutes`,
        questionCount: qCount,
        type: exam.type,
      };
    });

    // 2. Ajouter les examens disponibles (non encore soumis)
    const availableResult = availableExams
      .filter((exam: { id: string }) => !submittedExamIds.has(exam.id))
      .filter((exam: { id: string }) => !user.examId || user.examId === exam.id)
      .map((exam: any) => ({
        id: exam.id,
        examName: exam.title || exam.name,
        examDescription: exam.description,
        status: "AVAILABLE",
        score: 0,
        maxScore: exam.totalPoints || 100,
        passingScore: exam.passingScore || 65,
        startedAt: null,
        completedAt: null,
        duration: `${Math.round(exam.duration / 60)} minutes`,
        questionCount:
          exam.part1Questions +
          exam.part2Questions +
          (exam.part3Enabled ? 1 : 0),
        type: exam.type,
      }));

    const examsResult = [...completedExams, ...availableResult];

    // Statistiques pour le header des candidats
    const stats = {
      total: examsResult.length,
      completed: examsResult.filter((e) => e.status === "COMPLETED").length,
      inProgress: examsResult.filter((e) => e.status === "IN_PROGRESS").length,
      available: examsResult.filter((e) => e.status === "AVAILABLE").length,
      passed: examsResult.filter(
        (e) =>
          e.status === "COMPLETED" &&
          e.score >= e.maxScore * (e.passingScore / 100),
      ).length,
    };

    return NextResponse.json({
      exams: examsResult,
      stats,
    });
  } catch (error: unknown) {
    console.error("Erreur examens user:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
