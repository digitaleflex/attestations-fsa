// app/api/admin/exams/route.ts
// Admin routes for exam management with Better Auth support
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";

const ExamSchema = z.object({
  name: z.string().min(1),
  session: z.string().optional(),
  description: z.string().optional(),
  formationId: z.string(),
  duration: z.number().default(3600),
  passingScore: z.number().default(60),
  randomizeQuestions: z.boolean().default(false),
  showResults: z.boolean().default(false),
  status: z.string().default("DRAFT"),
  scheduledAt: z.string().optional(),
  // Use parts array format (same as PATCH) for complete exam structure
  parts: z
    .array(
      z.object({
        title: z.string(),
        type: z.string(),
        duration: z.number().optional(),
        points: z.number(),
        order: z.number(),
        enabled: z.boolean().default(true),
        subject: z.string().optional(),
        scenario: z.string().optional(),
        questions: z
          .array(
            z.object({
              text: z.string(),
              type: z.string(),
              points: z.number(),
              order: z.number().optional(),
              options: z
                .array(
                  z.object({
                    text: z.string(),
                    isCorrect: z.boolean(),
                    feedback: z.string().optional(),
                  }),
                )
                .optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

// POST /api/admin/exams - create a new exam
export async function POST(request: Request) {
  try {
    // 🔒 1. Vérifie si l'utilisateur est un administrateur
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Non autorisé - Admin requis" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parse = ExamSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        {
          message: "Entrée invalide",
          details: parse.error.errors,
        },
        { status: 400 },
      );
    }

    const {
      name,
      session,
      description,
      formationId,
      duration,
      passingScore,
      randomizeQuestions,
      showResults,
      status,
      scheduledAt,
      parts = [],
    } = parse.data;

    // Verify formation exists
    const formation = await prisma.formation.findUnique({
      where: { id: formationId },
    });

    if (!formation) {
      return NextResponse.json(
        {
          message: "Formation non trouvée",
        },
        { status: 404 },
      );
    }

    const totalPoints = parts.reduce(
      (sum: number, p: any) => sum + (p.enabled ? p.points : 0),
      0,
    );

    if (totalPoints === 0) {
      return NextResponse.json(
        {
          message: "Au moins une partie doit être activée avec des points",
        },
        { status: 400 },
      );
    }

    // ✅ Step 1: Create Exam (Core Information)
    const enabledParts = parts.filter((p: any) => p.enabled);
    const newExam = await prisma.exam.create({
      data: {
        name,
        title: name,
        session,
        description,
        formationId,
        duration,
        passingScore,
        totalPoints,
        randomizeQuestions,
        showResults,
        status: status as any,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        // Legacy fields for backward compatibility
        part1Enabled: enabledParts.some((p: any) => p.type === "QCM"),
        part2Enabled: enabledParts.some((p: any) => p.type === "OPEN"),
        part3Enabled: enabledParts.some((p: any) => p.type === "CASE_STUDY"),
        part1Questions:
          enabledParts.find((p: any) => p.type === "QCM")?.questions?.length ||
          0,
        part2Questions:
          enabledParts.find((p: any) => p.type === "OPEN")?.questions?.length ||
          0,
        part1Points:
          enabledParts.find((p: any) => p.type === "QCM")?.points || 0,
        part2Points:
          enabledParts.find((p: any) => p.type === "OPEN")?.points || 0,
        part3Points:
          enabledParts.find((p: any) => p.type === "CASE_STUDY")?.points || 0,
      },
    });

    const createdPartIds: string[] = [];

    // ✅ Step 2-4: Create Exam Parts using the provided parts array (same as PATCH)
    try {
      for (let pIdx = 0; pIdx < enabledParts.length; pIdx++) {
        const partData = enabledParts[pIdx];
        const part = await prisma.examPart.create({
          data: {
            examId: newExam.id,
            title: partData.title,
            type: partData.type as any,
            duration: partData.duration || 30,
            points: partData.points,
            order: partData.order ?? pIdx + 1,
            scenario: partData.scenario || partData.subject,
          },
        });
        createdPartIds.push(part.id);

        // Create questions for this part
        if (partData.questions && partData.questions.length > 0) {
          for (let qIdx = 0; qIdx < partData.questions.length; qIdx++) {
            const q = partData.questions[qIdx];
            await prisma.question.create({
              data: {
                partId: part.id,
                text: q.text,
                type: q.type as "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "OPEN",
                points: q.points,
                order: q.order ?? qIdx + 1,
                options:
                  (q.options?.length || 0) > 0 ? { create: q.options } : undefined,
              },
            });
          }
        }
      }
    } catch (saveError) {
      console.error(
        "[DATABASE SAVE ERROR] Rolling back exam creation:",
        saveError,
      );
      // Clean up orphaned records
      for (const partId of createdPartIds) {
        await prisma.examPart.delete({ where: { id: partId } }).catch(() => {});
      }
      await prisma.exam.delete({ where: { id: newExam.id } }).catch(() => {});
      throw saveError;
    }

    return NextResponse.json(
      {
        message: "Examen créé avec succès",
        exam: newExam,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Erreur lors de la création de l'examen:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la création de l'examen",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// GET /api/admin/exams - List exams
export async function GET() {
  try {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const exams = await prisma.exam.findMany({
      include: {
        formation: {
          select: { name: true, category: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(exams);
  } catch (error) {
    console.error("Erreur liste examens:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
