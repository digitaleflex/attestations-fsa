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
  part1Enabled: z.boolean().default(true),
  part1Questions: z.number().default(20),
  part1Points: z.number().default(20),
  part2Enabled: z.boolean().default(true),
  part2Questions: z.number().default(5),
  part2Points: z.number().default(40),
  part3Enabled: z.boolean().default(true),
  part3Subject: z.string().optional(),
  part3Points: z.number().default(40),
  part3Mode: z.string().default("digital"),
  randomizeQuestions: z.boolean().default(false),
  showResults: z.boolean().default(false),
  status: z.string().default("DRAFT"),
  qcmQuestions: z.array(z.any()).default([]),
  openQuestions: z.array(z.any()).default([]),
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
      part1Enabled,
      part1Points,
      part2Enabled,
      part2Points,
      part3Enabled,
      part3Subject,
      part3Points,
      part3Mode,
      randomizeQuestions,
      showResults,
      status,
      qcmQuestions = [],
      openQuestions = [],
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

    const totalPoints =
      (part1Enabled ? part1Points : 0) +
      (part2Enabled ? part2Points : 0) +
      (part3Enabled ? part3Points : 0);

    if (totalPoints === 0) {
      return NextResponse.json(
        {
          message: "Au moins une partie doit être activée avec des points",
        },
        { status: 400 },
      );
    }

    // ✅ Step 1: Create Exam (Core Informations)
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
        part1Enabled,
        part1Questions: qcmQuestions.length || 0,
        part1Points,
        part2Enabled,
        part2Questions: openQuestions.length || 0,
        part2Points,
        part3Enabled,
        part3Subject,
        part3Points,
        part3Mode,
        randomizeQuestions,
        showResults,
        status: status as any,
      },
    });

    const createdPartIds: string[] = [];

    // ✅ Step 2-4: Create Exam Parts in a single efficient transaction
    const partsToCreate: any[] = [];

    if (part1Enabled && qcmQuestions.length > 0) {
      partsToCreate.push({
        examId: newExam.id,
        title: "Partie 1 : QCM",
        type: "QCM",
        duration: Math.floor(duration / 3 / 60) || 30,
        points: part1Points,
        order: 1,
        questions: qcmQuestions.map((q: any, i: number) => ({
          text: q.text || `Question QCM ${i + 1}`,
          type: (q.type as any) || "SINGLE_CHOICE",
          points: q.points || 1,
          order: i + 1,
          options: (q.options || []).map((opt: any) => ({
            text: opt.text || "...",
            isCorrect: opt.isCorrect,
            feedback: opt.feedback || "",
          })),
        })),
      });
    }

    if (part2Enabled && openQuestions.length > 0) {
      partsToCreate.push({
        examId: newExam.id,
        title: "Partie 2 : Questions Ouvertes",
        type: "OPEN",
        duration: Math.floor(duration / 3 / 60) || 30,
        points: part2Points,
        order: 2,
        questions: openQuestions.map((q: any, i: number) => ({
          text: q.text || `Question ouverte ${i + 1}`,
          type: "OPEN",
          points: q.points || 5,
          order: i + 1,
        })),
      });
    }

    if (part3Enabled) {
      partsToCreate.push({
        examId: newExam.id,
        title: "Partie 3 : Étude de Cas",
        type: "CASE_STUDY",
        duration: Math.floor(duration / 3 / 60) || 30,
        points: part3Points,
        order: 3,
        scenario: part3Subject,
      });
    }

    // ✅ Execute part creation (without transaction to avoid Accelerate timeout)
    try {
      for (const partData of partsToCreate) {
        const { questions, ...partInfo } = partData;

        const part = await prisma.examPart.create({
          data: partInfo,
        });
        createdPartIds.push(part.id);

        // Create questions (individual inserts, faster than transaction)
        if (questions && questions.length > 0) {
          for (const q of questions) {
            await prisma.question.create({
              data: {
                partId: part.id,
                text: q.text,
                type: q.type as any,
                points: q.points,
                order: q.order,
                options:
                  q.options?.length > 0 ? { create: q.options } : undefined,
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
      return NextResponse.json({ error: "Non autorisé" }, { status: 0 }); // Fallback code 0 for legacy but unauthorized
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
