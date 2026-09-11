import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser, getCurrentUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  const adminUser = await getAdminUser(request);
  if (!user && !adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        name: true,
        description: true,
        status: true,
        totalPoints: true,
        duration: true,
        formationId: true,
        type: true,
        scheduledAt: true,
        passingScore: true,
        randomizeQuestions: true,
        showResults: true,
        part1Enabled: true,
        part1Points: true,
        part1Questions: true,
        part2Enabled: true,
        part2Points: true,
        part2Questions: true,
        part3Enabled: true,
        part3Mode: true,
        part3Points: true,
        part3Subject: true,
        parts: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            examId: true,
            title: true,
            type: true,
            duration: true,
            points: true,
            order: true,
            scenario: true,
            questions: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                partId: true,
                text: true,
                type: true,
                points: true,
                order: true,
                // ⚠️ isCorrect / feedback NEVER exposed to candidates
                options: {
                  select: {
                    id: true,
                    text: true,
                  },
                },
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
      title, 
      description, 
      status, 
      scheduledAt, 
      parts,
      formationId,
      duration,
      passingScore,
      randomizeQuestions,
      showResults,
      type
    } = body;

    // 1. Calculate summary data and prepare atomic update
    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : null;
    const isValidDate = scheduledAtDate === null || !isNaN(scheduledAtDate.getTime());
    
    // Calculate totals for summary fields
    const enabledParts = (parts && Array.isArray(parts)) ? parts.filter(p => p.enabled) : [];
    const totalPoints = enabledParts.reduce((sum: number, p: any) => sum + (parseFloat(p.points?.toString() || "0")), 0);

    // 🏆 ATOMIC UPDATE
    const exam = await prisma.exam.update({
      where: { id },
      data: {
        title,
        description,
        status,
        scheduledAt: isValidDate ? scheduledAtDate : null,
        formation: formationId ? { connect: { id: formationId } } : undefined,
        duration: (duration !== undefined && duration !== null) ? parseInt(duration.toString()) : undefined,
        passingScore: (passingScore !== undefined && passingScore !== null) ? parseInt(passingScore.toString()) : undefined,
        randomizeQuestions: randomizeQuestions === true,
        showResults: showResults === true,
        type: type || undefined,
        totalPoints: Math.round(totalPoints),
        part1Enabled: enabledParts.some(p => p.type === "QCM"),
        part2Enabled: enabledParts.some(p => p.type === "OPEN"),
        part3Enabled: enabledParts.some(p => p.type === "CASE_STUDY"),
        part1Questions: enabledParts.find(p => p.type === "QCM")?.questions?.length || 0,
        part2Questions: enabledParts.find(p => p.type === "OPEN")?.questions?.length || 0,
        part1Points: Math.round(parseFloat(enabledParts.find(p => p.type === "QCM")?.points?.toString() || "0")),
        part2Points: Math.round(parseFloat(enabledParts.find(p => p.type === "OPEN")?.points?.toString() || "0")),
        part3Points: Math.round(parseFloat(enabledParts.find(p => p.type === "CASE_STUDY")?.points?.toString() || "0")),
        
        // 🔄 Replace parts and questions in one go if provided
        ...(parts && Array.isArray(parts) ? {
          parts: {
            deleteMany: {},
            create: parts.map((p, pIdx) => ({
              title: p.title,
              type: p.type as any,
              duration: p.duration ? parseInt(p.duration.toString()) : 30,
              points: p.points ? parseInt(p.points.toString()) : 0,
              order: p.order ? parseInt(p.order.toString()) : pIdx + 1,
              scenario: p.scenario,
              questions: {
                create: (p.questions || []).map((q: any, qIdx: number) => ({
                  text: q.text,
                  type: q.type as any,
                  points: q.points ? parseFloat(q.points.toString()) : 0,
                  order: q.order ? parseInt(q.order.toString()) : qIdx + 1,
                  options: (q.options || []).length > 0 ? {
                    create: q.options.map((o: any) => ({
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
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
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
