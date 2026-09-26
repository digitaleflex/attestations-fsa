import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { applyRateLimitByUser } from "@/lib/rate-limit";
import { autoOpenDueExams, isExamAvailable } from "@/lib/exams/availability";
import { hasOpened, opensOn } from "@/lib/exams/time";
import {
  round2,
  isCorrected,
  resolveExamMax,
  computeFinalScore,
  isPassed,
} from "@/lib/exams/scoring";

/** Mapping d'affichage canonique des statuts de session. */
function displayStatus(
  status: string,
): "COMPLETED" | "SUBMITTED" | "IN_PROGRESS" {
  if (isCorrected(status)) return "COMPLETED";
  if (status === "PENDING_REVIEW") return "SUBMITTED";
  return "IN_PROGRESS";
}

// Schéma de validation pour les examens
const ExamsQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(["OFFICIAL", "MOCK"]).optional(),
  limit: z.coerce.number().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  try {
    const userAuth = await getCurrentUser(request);
    if (!userAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = userAuth.id;

    // #256 — la liste des examens du candidat n'était pas limitée : elle
    // énumère les examens OFFICIAL visibles et leur barème. Même budget que la
    // lecture d'un examen.
    const rateLimit = await applyRateLimitByUser(request, userId, "examRead");
    if (!rateLimit.allowed) return rateLimit.response;

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

    // #256 m9 — une seule référence temporelle pour toutes les décisions de
    // visibilité de cette réponse.
    const now = new Date();

    // Ouvre paresseusement les examens SCHEDULED arrivés à échéance.
    await autoOpenDueExams(now);

    // Requêtes PARALLÈLES (Gain de temps massif)
    const [user, availableExams, enrollments, submissions] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        }),
        prisma.exam.findMany({
          where: {
            status: { in: ["SCHEDULED", "PUBLISHED"] },
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
            status: true,
            scheduledAt: true,
          },
          ...(params.data.limit ? { take: params.data.limit } : {}),
        }),
        prisma.examEnrollment.findMany({
          // #256 : seules les inscriptions ACTIVES ouvrent un OFFICIAL ; une
          // inscription révoquée est conservée en base (traçabilité) mais ne
          // doit plus rendre l'examen lisible dans la liste du candidat.
          where: { userId, status: "ACTIVE" },
          select: { examId: true },
        }),
        prisma.examSession.findMany({
          where: {
            userId,
            exam: {
              type: params.data.type || undefined,
            },
          },
          select: {
            id: true,
            examId: true,
            totalScore: true,
            finalScore: true,
            submittedAt: true,
            status: true,
            answers: true,
            exam: {
              select: {
                title: true,
                name: true,
                description: true,
                totalPoints: true,
                part1Points: true,
                part2Points: true,
                part3Points: true,
                part1Enabled: true,
                part2Enabled: true,
                part3Enabled: true,
                passingScore: true,
                duration: true,
                part1Questions: true,
                part2Questions: true,
                type: true,
                status: true,
                scheduledAt: true,
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
    const completedExams = submissions.map((sub) => {
      const exam = sub.exam;
      // #256 m9 — avant le jour J, aucun contenu d'examen (description,
      // barème, durée, volume de questions) ne sort de cette route, même si
      // une session existe. Seuls le nom et la date d'ouverture sont annoncés.
      const opened = hasOpened(exam, now);
      const qCount =
        exam.part1Questions + exam.part2Questions + (exam.part3Enabled ? 1 : 0);

      // Récupérer le barème personnalisé s'il existe
      const customBareme =
        sub.answers && typeof sub.answers === "object"
          ? (sub.answers as { _customBareme?: { totalMax?: number } })
              ._customBareme
          : null;

      const maxScore = customBareme?.totalMax ?? resolveExamMax(exam);
      const isDone = isCorrected(sub.status);
      const hasFinalScore =
        typeof sub.finalScore === "number" && sub.finalScore > 0;
      const finalScore = isDone
        ? hasFinalScore
          ? round2(sub.finalScore)
          : computeFinalScore(sub.totalScore, maxScore)
        : null;
      const passingScore = exam.passingScore ?? 65;

      return {
        id: sub.examId,
        submissionId: sub.id,
        examName: exam.title || exam.name,
        examDescription: opened ? exam.description : null,
        status: displayStatus(sub.status),
        score: sub.totalScore,
        maxScore: opened ? maxScore : null,
        finalScore,
        passingScore: opened ? (exam.passingScore ?? 65) : null,
        passed:
          isDone && finalScore !== null && isPassed(finalScore, passingScore),
        startedAt: sub.submittedAt,
        completedAt: sub.submittedAt,
        duration: opened ? `${Math.round(exam.duration / 60)} minutes` : null,
        questionCount: opened ? qCount : null,
        type: exam.type,
        isAvailable: false,
        locked: !opened,
        opensAt: (opensOn(exam) ?? null)?.toISOString() ?? null,
      };
    });

    const enrolledExamIds = new Set(
      enrollments.map((enrollment: { examId: string }) => enrollment.examId),
    );

    // 2. Ajouter les examens disponibles (non encore soumis)
    const availableResult = availableExams
      .filter((exam: { id: string }) => !submittedExamIds.has(exam.id))
      .filter(
        (exam: any) => exam.type === "MOCK" || enrolledExamIds.has(exam.id),
      )
      .map((exam: any) => {
        // #256 m9 — annonce seule tant que le jour J n'est pas atteint : ni
        // description, ni barème, ni durée, ni volume de questions. Le front
        // affiche déjà « Bientôt disponible » via `isAvailable: false`.
        const opened = hasOpened(exam, now);
        return {
          id: exam.id,
          examName: exam.title || exam.name,
          examDescription: opened ? exam.description : null,
          status: "AVAILABLE",
          score: 0,
          maxScore: opened ? exam.totalPoints || 100 : null,
          finalScore: null,
          passingScore: opened ? (exam.passingScore ?? 65) : null,
          passed: false,
          startedAt: null,
          completedAt: null,
          scheduledAt: exam.scheduledAt,
          opensAt: (opensOn(exam) ?? null)?.toISOString() ?? null,
          isAvailable: isExamAvailable(exam, now),
          locked: !opened,
          duration: opened ? `${Math.round(exam.duration / 60)} minutes` : null,
          questionCount: opened
            ? exam.part1Questions +
              exam.part2Questions +
              (exam.part3Enabled ? 1 : 0)
            : null,
          type: exam.type,
        };
      });

    const examsResult = [...completedExams, ...availableResult];

    // Statistiques pour le header des candidats
    const stats = {
      total: examsResult.length,
      completed: examsResult.filter((e) => e.status === "COMPLETED").length,
      inProgress: examsResult.filter((e) => e.status === "IN_PROGRESS").length,
      available: examsResult.filter((e) => e.status === "AVAILABLE").length,
      passed: examsResult.filter(
        (e) => e.status === "COMPLETED" && e.passed === true,
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
