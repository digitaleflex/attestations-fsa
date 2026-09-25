import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser, getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { isExamAvailable } from "@/lib/exams/availability";
import {
  checkExamEligibility,
  enrollmentForbiddenResponse,
} from "@/lib/exams/eligibility";

/**
 * POST /api/exams/[id]/start
 * Démarre une session d'examen pour l'utilisateur connecté
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const adminUser = await getAdminUser(request);

    const { id: examId } = await params;

    // 1. Vérifier si l'examen existe et est publié
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        status: true,
        duration: true,
        type: true,
        scheduledAt: true,
      },
    });

    if (!exam || !isExamAvailable(exam)) {
      return NextResponse.json(
        { error: "Examen non disponible" },
        { status: 404 },
      );
    }

    const eligibility = await checkExamEligibility({
      userId: user.id,
      examId: exam.id,
      examType: exam.type,
      isAdmin: adminUser !== null,
    });
    if (!eligibility.eligible) {
      return enrollmentForbiddenResponse(eligibility);
    }

    // Ouvre l'examen paresseusement s'il est planifié et arrivé à échéance.
    if (exam.status === "SCHEDULED") {
      await prisma.exam.update({
        where: { id: examId },
        data: { status: "PUBLISHED" },
      });
    }

    // 1.5 Vérifier si l'utilisateur est restreint à un examen spécifique
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { examId: true },
    });

    if (!adminUser && userRecord?.examId && userRecord.examId !== examId) {
      return NextResponse.json(
        {
          error:
            "Accès restreint : Vous n'êtes pas autorisé à passer cet examen spécifique.",
        },
        { status: 403 },
      );
    }

    // 2. Vérifier si une session existe déjà
    const existingSession = await prisma.examSession.findFirst({
      where: {
        examId,
        userId: user.id,
      },
    });

    if (existingSession) {
      // Si déjà soumis (auto-corrigé ou en revue) ou noté, on ne peut pas recommencer
      if (
        ["COMPLETED", "GRADED", "PENDING_REVIEW"].includes(
          existingSession.status,
        )
      ) {
        return NextResponse.json(
          {
            error: "Examen déjà soumis",
            status: existingSession.status,
          },
          { status: 400 },
        );
      }

      // Calculer le temps restant
      const now = new Date();
      const startedAt = new Date(existingSession.startedAt);
      const elapsedSeconds = Math.floor(
        (now.getTime() - startedAt.getTime()) / 1000,
      );
      const remainingSeconds = Math.max(0, exam.duration - elapsedSeconds);

      return NextResponse.json({
        message: "Session existante reprise",
        sessionId: existingSession.id,
        duration: remainingSeconds,
        status: existingSession.status,
      });
    }

    // 3. Créer une nouvelle session — upsert transactionnel (anti-race #121) :
    //    deux POST /start simultanés ne peuvent plus créer deux sessions,
    //    la contrainte @@unique([userId, examId]) garantit une seule ligne.
    const session = await prisma.examSession.upsert({
      where: { userId_examId: { userId: user.id, examId } },
      create: {
        examId,
        userId: user.id,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        type: exam.type,
      },
      // Une session concurrente a pu être créée entre le findFirst et ici :
      // on la reprend telle quelle (elle est IN_PROGRESS, déjà vérifiée).
      update: {},
    });

    // Enregistrer le log d'audit
    await createAuditLog({
      userId: user.id,
      action: "EXAM_STARTED",
      resource: "EXAM",
      resourceId: examId,
      newValue: { sessionId: session.id, startedAt: session.startedAt },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
    });

    return NextResponse.json(
      {
        message: "Examen démarré",
        sessionId: session.id,
        duration: exam.duration,
        status: "IN_PROGRESS",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[EXAM_START_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
