// app/api/admin/exams/[id]/route.ts
// Admin exam update route
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
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
  if (!(await isAdminAuthenticated())) {
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
    } = body;

    // 1. Update basic exam info first
    await prisma.exam.update({
      where: { id },
      data: {
        name: name || title,
        title: title,
        description,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        formationId,
        session,
        duration: duration ? parseInt(duration.toString()) : undefined,
        passingScore: passingScore ? parseInt(passingScore.toString()) : undefined,
        randomizeQuestions: randomizeQuestions === true,
        showResults: showResults === true,
      },
    });

    // 2. If parts are provided, replace them (without transaction to avoid Accelerate timeout)
    if (parts && Array.isArray(parts)) {
      // Delete all existing parts (Cascade will handle questions and options)
      await prisma.examPart.deleteMany({
        where: { examId: id },
      });

      // Calculate total points
      const totalPoints = parts.reduce(
        (sum: number, p: any) => sum + (p.enabled ? p.points : 0),
        0,
      );

      // Update exam with parts info
      await prisma.exam.update({
        where: { id },
        data: {
          totalPoints,
          part1Enabled: parts.some((p: any) => p.type === "QCM"),
          part2Enabled: parts.some((p: any) => p.type === "OPEN"),
          part3Enabled: parts.some((p: any) => p.type === "CASE_STUDY"),
          part1Questions:
            parts.find((p: any) => p.type === "QCM")?.questions?.length || 0,
          part2Questions:
            parts.find((p: any) => p.type === "OPEN")?.questions?.length || 0,
          part1Points: parts.find((p: any) => p.type === "QCM")?.points || 0,
          part2Points: parts.find((p: any) => p.type === "OPEN")?.points || 0,
          part3Points:
            parts.find((p: any) => p.type === "CASE_STUDY")?.points || 0,
        },
      });

      // Create new parts one by one
      for (let pIdx = 0; pIdx < parts.length; pIdx++) {
        const part = parts[pIdx];
        const newPart = await prisma.examPart.create({
          data: {
            examId: id,
            title: part.title,
            type: part.type as any,
            duration: part.duration || 30,
            points: part.points,
            order: part.order ?? pIdx + 1,
            scenario: part.scenario,
          },
        });

        // Create questions for this part
        if (part.questions && part.questions.length > 0) {
          for (let qIdx = 0; qIdx < part.questions.length; qIdx++) {
            const q = part.questions[qIdx];
            await prisma.question.create({
              data: {
                partId: newPart.id,
                text: q.text,
                type: q.type as any,
                points: q.points,
                order: q.order ?? qIdx + 1,
                options:
                  q.options?.length > 0
                    ? {
                        create: q.options.map((o: any) => ({
                          text: o.text,
                          isCorrect: o.isCorrect,
                          feedback: o.feedback || "",
                        })),
                      }
                    : undefined,
              },
            });
          }
        }
      }
    }

    // Return the updated exam with all relations
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

    return NextResponse.json(exam);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la mise à jour de l'examen" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.exam.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Examen supprimé avec succès" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la suppression de l'examen" },
      { status: 500 },
    );
  }
}
