// app/api/admin/exams/route.ts
// Admin routes for exam management with Better Auth support
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";

const ExamSchema = z.object({
  name: z.string().min(1),
  session: z.string().optional(),
  description: z.string().optional(),
  formationId: z.string(),
  duration: z.coerce.number().default(3600),
  passingScore: z.coerce.number().default(65),
  randomizeQuestions: z.boolean().default(false),
  showResults: z.boolean().default(false),
  status: z.string().default("DRAFT"),
  scheduledAt: z.string().optional(),
  type: z.string().optional(),
  // Use parts array format (same as PATCH) for complete exam structure
  parts: z
    .array(
      z.object({
        title: z.string(),
        type: z.string(),
        duration: z.coerce.number().optional(),
        points: z.coerce.number(),
        order: z.coerce.number(),
        enabled: z.boolean().default(true),
        subject: z.string().optional(),
        scenario: z.string().optional(),
        questions: z
          .array(
            z.object({
              text: z.string(),
              type: z.string(),
              points: z.coerce.number(),
              order: z.coerce.number().optional(),
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
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
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

    const enabledParts = parts.filter((p) => p.enabled);
    const totalPoints = enabledParts.reduce(
      (sum, p) => sum + p.points,
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

    // ✅ ATOMIC CREATE (Single DB roundtrip)
    const newExam = await prisma.exam.create({
      data: {
        name,
        title: name,
        session,
        description,
        formation: { connect: { id: formationId } },
        duration,
        passingScore,
        totalPoints: Math.round(totalPoints),
        randomizeQuestions,
        showResults,
        status: status as any,
        type: (body.type as any) || "OFFICIAL",
        scheduledAt: (scheduledAt && !isNaN(new Date(scheduledAt).getTime())) ? new Date(scheduledAt) : null,
        
        // Legacy summary fields
        part1Enabled: enabledParts.some((p) => p.type === "QCM"),
        part2Enabled: enabledParts.some((p) => p.type === "OPEN"),
        part3Enabled: enabledParts.some((p) => p.type === "CASE_STUDY"),
        part1Questions: enabledParts.find((p) => p.type === "QCM")?.questions?.length || 0,
        part2Questions: enabledParts.find((p) => p.type === "OPEN")?.questions?.length || 0,
        part1Points: Math.round(enabledParts.find((p) => p.type === "QCM")?.points || 0),
        part2Points: Math.round(enabledParts.find((p) => p.type === "OPEN")?.points || 0),
        part3Points: Math.round(enabledParts.find((p) => p.type === "CASE_STUDY")?.points || 0),

        // Nested creation of parts and questions
        parts: {
          create: enabledParts.map((p, pIdx) => ({
            title: p.title,
            type: p.type as any,
            duration: p.duration || 30,
            points: Math.round(p.points),
            order: p.order ?? pIdx + 1,
            scenario: p.scenario || p.subject,
            questions: {
              create: (p.questions || []).map((q: any, qIdx: number) => ({
                text: q.text,
                type: q.type as any,
                points: q.points, // Question.points is Float
                order: q.order ?? qIdx + 1,
                options: (q.options?.length || 0) > 0 ? {
                  create: q.options.map((o: any) => ({
                    text: o.text,
                    isCorrect: o.isCorrect,
                    feedback: o.feedback || "",
                  }))
                } : undefined
              }))
            }
          }))
        }
      },
      include: {
        formation: true,
        parts: true
      }
    });

    // 🛡️ Audit Log
    if (adminUser?.id) {
      await prisma.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'EXAM_CREATED',
          resource: 'EXAM',
          resourceId: newExam.id,
          newValue: { title: newExam.title, type: newExam.type, status: newExam.status },
        }
      }).catch((err: any) => console.error("Audit log failed:", err));
    }

    return NextResponse.json(
      {
        message: "Examen créé avec succès",
        exam: newExam,
      },
      { status: 201 },
    );
    } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("Erreur lors de la création de l'examen:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la création de l'examen",
        details: message,
      },
      { status: 500 },
    );
  }
}

// GET /api/admin/exams - List exams
export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
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
