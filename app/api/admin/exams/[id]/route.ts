// app/api/admin/exams/[id]/route.ts
// Admin exam update route
import { NextResponse, NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { ExamStatus, ExamType, QuestionType } from "@prisma/client";

interface OptionPayload {
  text: string;
  isCorrect: boolean | string;
  feedback?: string;
}

interface QuestionPayload {
  text: string;
  type: string;
  points: number | string;
  order?: number | string;
  options?: OptionPayload[];
}

interface ExamPartPayload {
  title: string;
  type: string;
  enabled?: boolean;
  points?: number | string;
  duration?: number | string;
  order?: number | string;
  scenario?: string;
  mode?: string;
  questions?: QuestionPayload[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        formation: true,
        parts: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json(
        { message: "Examen non trouvé" },
        { status: 404 },
      );
    }

    return NextResponse.json(exam);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la récupération de l'examen" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      title,
      description,
      status,
      scheduledAt,
      parts,
      formationId,
      session,
      duration,
      passingScore,
      randomizeQuestions,
      showResults,
      type,
    } = body;

    // 1. Calculate summary data and prepare atomic update
    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : null;
    const isValidDate = scheduledAtDate === null || !isNaN(scheduledAtDate.getTime());
    
    // Calculate totals for summary fields
    const enabledParts = (parts && Array.isArray(parts)) ? parts.filter((p: ExamPartPayload) => p.enabled) : [];
    const totalPoints = enabledParts.reduce((sum: number, p: ExamPartPayload) => sum + (parseFloat(p.points?.toString() || "0")), 0);

    // 🏆 ATOMIC UPDATE (Single DB roundtrip for the entire exam structure)
    const exam = await prisma.exam.update({
      where: { id },
      data: {
        name: name || title,
        title: title,
        description,
        status,
        scheduledAt: isValidDate ? scheduledAtDate : null,
        formation: formationId ? { connect: { id: formationId } } : undefined,
        session,
        duration: (duration !== undefined && duration !== null) ? parseInt(duration.toString()) : undefined,
        passingScore: (passingScore !== undefined && passingScore !== null) ? parseInt(passingScore.toString()) : undefined,
        randomizeQuestions: randomizeQuestions === true,
        showResults: showResults === true,
        type: type || undefined,
        totalPoints: Math.round(totalPoints),
        part1Enabled: enabledParts.some((p: ExamPartPayload) => p.type === "QCM"),
        part2Enabled: enabledParts.some((p: ExamPartPayload) => p.type === "OPEN"),
        part3Enabled: enabledParts.some((p: ExamPartPayload) => p.type === "CASE_STUDY"),
        part1Questions: enabledParts.find((p: ExamPartPayload) => p.type === "QCM")?.questions?.length || 0,
        part2Questions: enabledParts.find((p: ExamPartPayload) => p.type === "OPEN")?.questions?.length || 0,
        part1Points: Math.round(parseFloat(enabledParts.find((p: ExamPartPayload) => p.type === "QCM")?.points?.toString() || "0")),
        part2Points: Math.round(parseFloat(enabledParts.find((p: ExamPartPayload) => p.type === "OPEN")?.points?.toString() || "0")),
        part3Points: Math.round(parseFloat(enabledParts.find((p: ExamPartPayload) => p.type === "CASE_STUDY")?.points?.toString() || "0")),
        part3Mode: (enabledParts.find((p: ExamPartPayload) => p.type === "CASE_STUDY")?.mode as string) || "digital",
        part3Subject: enabledParts.find((p: ExamPartPayload) => p.type === "CASE_STUDY")?.scenario,
        
        // 🔄 Replace parts and questions in one go if provided
        ...(parts && Array.isArray(parts) ? {
          parts: {
            deleteMany: {},
            create: parts.map((p: ExamPartPayload, pIdx: number) => ({
              title: p.title,
              type: p.type,
              duration: p.duration ? parseInt(p.duration.toString()) : 30,
              points: p.points ? parseInt(p.points.toString()) : 0,
              order: p.order ? parseInt(p.order.toString()) : pIdx + 1,
              scenario: p.scenario,
              questions: {
                create: (p.questions || []).map((q: QuestionPayload, qIdx: number) => ({
                  text: q.text,
                  type: q.type as QuestionType,
                  points: q.points ? parseFloat(q.points.toString()) : 0,
                  order: q.order ? parseInt(q.order.toString()) : qIdx + 1,
                  options: (q.options || []).length > 0 ? {
                    create: q.options!.map((o: OptionPayload) => ({
                      text: o.text,
                      isCorrect: o.isCorrect === true || o.isCorrect === "true",
                      feedback: o.feedback || "",
                    }))
                  } : undefined
                }))
              }
            }))
          }
        } : {})
      },
      include: {
        formation: true,
        parts: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: {
                options: true,
              },
            },
          },
        },
      },
    });


    // 🛡️ Audit Log (Safety check for null id)
    if (adminUser?.id) {
      await createAuditLog({
        userId: adminUser.id,
        action: 'EXAM_UPDATED',
        resource: 'EXAM',
        resourceId: id,
        newValue: { title: exam?.title, type: exam?.type, status: exam?.status },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown"
      });
    }

    revalidateTag("exams", { expire: 0 });

    return NextResponse.json(exam);
  } catch (error) {
    console.error("[EXAM_UPDATE_ERROR]", error);
    return NextResponse.json(
      { message: "Erreur lors de la mise à jour de l'examen", details: error instanceof Error ? error.message : "Erreur inconnue" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.exam.delete({
      where: { id },
    });

    // 🛡️ Audit Log (Safety check for null id)
    if (adminUser?.id) {
      await createAuditLog({
        userId: adminUser.id,
        action: 'EXAM_DELETED',
        resource: 'EXAM',
        resourceId: id,
        newValue: { deletedAt: new Date().toISOString() },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown"
      });
    }

    revalidateTag("exams", { expire: 0 });

    return NextResponse.json({ message: "Examen supprimé avec succès" });
  } catch (error) {
    console.error("[EXAM_DELETE_ERROR]", error);
    return NextResponse.json(
      { message: "Erreur lors de la suppression de l'examen", details: error instanceof Error ? error.message : "Erreur inconnue" },
      { status: 500 },
    );
  }
}

