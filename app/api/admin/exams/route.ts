// app/api/admin/exams/route.ts
// Admin routes for exam management with Better Auth support
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { ExamStatus, ExamType, QuestionType } from "@prisma/client";
import { isExamStatus } from "@/lib/exams/transitions";

interface OptionPayload {
  text: string;
  isCorrect: boolean;
  feedback?: string;
}

interface QuestionPayload {
  text: string;
  type: string;
  points: number;
  order?: number;
  options?: OptionPayload[];
}

const ExamSchema = z.object({
  name: z.string().min(1),
  session: z.string().optional(),
  description: z.string().optional(),
  formationId: z.string(),
  duration: z.coerce.number().default(3600),
  // #123 — seuil en entier (le formulaire envoie un % ; on arrondit
  // pour éviter 62.5 → erreur Prisma Int).
  passingScore: z.coerce.number().transform((n) => Math.round(n)).default(65),
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
        mode: z.string().optional(),
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

    // #256 m9 — le statut de création est validé contre la liste canonique
    // (DRAFT | PUBLISHED | SCHEDULED | ARCHIVED) : pas de valeur arbitraire
    // en base, et un SCHEDULED doit porter sa date d'ouverture.
    const requestedStatus = status === "" ? "DRAFT" : status;
    if (!isExamStatus(requestedStatus)) {
      return NextResponse.json(
        {
          message: `Statut d'examen invalide : ${String(status)}`,
          code: "INVALID_EXAM_STATUS",
        },
        { status: 400 },
      );
    }
    const parsedScheduledAt =
      scheduledAt && !isNaN(new Date(scheduledAt).getTime())
        ? new Date(scheduledAt)
        : null;
    if (requestedStatus === "SCHEDULED" && parsedScheduledAt === null) {
      return NextResponse.json(
        {
          message:
            "Un examen programmé (SCHEDULED) doit porter une date d'ouverture (scheduledAt).",
          code: "MISSING_SCHEDULED_AT",
        },
        { status: 400 },
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
        status: requestedStatus as ExamStatus,
        type: (body.type as ExamType) || "OFFICIAL",
        scheduledAt: parsedScheduledAt,
        
        // Legacy summary fields — partNPoints = somme de TOUTES les parties
        // du type (cohérent avec totalPoints, même à parties multiples).
        part1Enabled: enabledParts.some((p) => p.type === "QCM"),
        part2Enabled: enabledParts.some((p) => p.type === "OPEN"),
        part3Enabled: enabledParts.some((p) => p.type === "CASE_STUDY"),
        part1Questions: enabledParts.filter((p) => p.type === "QCM").reduce((n, p) => n + (p.questions?.length || 0), 0),
        part2Questions: enabledParts.filter((p) => p.type === "OPEN").reduce((n, p) => n + (p.questions?.length || 0), 0),
        part1Points: Math.round(enabledParts.filter((p) => p.type === "QCM").reduce((n, p) => n + (p.points || 0), 0)),
        part2Points: Math.round(enabledParts.filter((p) => p.type === "OPEN").reduce((n, p) => n + (p.points || 0), 0)),
        part3Points: Math.round(enabledParts.filter((p) => p.type === "CASE_STUDY").reduce((n, p) => n + (p.points || 0), 0)),
        part3Mode: enabledParts.find((p) => p.type === "CASE_STUDY")?.mode as string || "digital",
        part3Subject: enabledParts.find((p) => p.type === "CASE_STUDY")?.scenario || enabledParts.find((p) => p.type === "CASE_STUDY")?.subject,

        // Nested creation of parts and questions
        parts: {
          create: enabledParts.map((p, pIdx) => ({
            title: p.title,
            type: p.type,
            duration: p.duration || 30,
            points: Math.round(p.points),
            order: p.order ?? pIdx + 1,
            scenario: p.scenario || p.subject,
            questions: {
              create: (p.questions || []).map((q: QuestionPayload, qIdx: number) => ({
                text: q.text,
                type: q.type as QuestionType,
                points: q.points, // Question.points is Float
                order: q.order ?? qIdx + 1,
                options: (q.options?.length || 0) > 0 ? {
                  create: q.options!.map((o: OptionPayload) => ({
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
      }).catch((err: unknown) => console.error("Audit log failed:", err));
    }

    revalidateTag("exams", { expire: 0 });

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
