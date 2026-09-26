import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser, getCurrentUser } from "@/lib/auth";
import { hasOpened, lockedPayload } from "@/lib/exams/time";
import {
  checkExamEligibility,
  enrollmentForbiddenResponse,
} from "@/lib/exams/eligibility";
import { applyRateLimit, applyRateLimitByUser } from "@/lib/rate-limit";
import { validateExamStatusTransition } from "@/lib/exams/transitions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  const adminUser = await getAdminUser(request);
  if (!user && !adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // #256 — point d'entrée candidat non couvert avant ce lot : la lecture d'un
  // examen livre les questions et le barème. Limité par utilisateur quand il
  // y en a un, par IP sinon (navigation admin).
  const rateLimit = user
    ? await applyRateLimitByUser(request, user.id, "examRead")
    : await applyRateLimit(request, "examRead");
  if (!rateLimit.allowed) return rateLimit.response;

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
        opensOn: true,
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

    // Verrou candidat : un examen non encore ouvert n'est lisible que par un admin.
    // 423 (Locked) — la date d'ouverture est annoncée, jamais le contenu
    // (description, barème, durée, questions) : la réponse ne contient que
    // les métadonnées d'annonce construites par `lockedPayload`.
    const now = new Date();
    if (!adminUser && !hasOpened(exam, now)) {
      return NextResponse.json(lockedPayload(exam, now), { status: 423 });
    }

    if (user) {
      const eligibility = await checkExamEligibility({
        userId: user.id,
        examId: exam.id,
        examType: exam.type,
        isAdmin: adminUser !== null,
      });
      if (!eligibility.eligible) {
        return enrollmentForbiddenResponse(eligibility);
      }
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
      opensOn: opensOnInput,
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
    if (!isValidDate) {
      return NextResponse.json(
        {
          message: `Date de démarrage illisible : ${String(scheduledAt)}`,
          code: "INVALID_SCHEDULED_AT",
        },
        { status: 400 },
      );
    }

    // #256 m9 — `opensOn` est stocké tel que fourni, puis normalisé au minuit de
    // `APP_TIMEZONE` à la lecture (`lib/exams/time.ts`). Une date illisible est
    // un 400, jamais une 500.
    const hasOpensOnInput = "opensOn" in body;
    const opensOnDate =
      opensOnInput && opensOnInput !== null && opensOnInput !== undefined
        ? new Date(opensOnInput)
        : null;
    if (opensOnDate && isNaN(opensOnDate.getTime())) {
      return NextResponse.json(
        {
          message: `Journée d'ouverture illisible : ${String(opensOnInput)}`,
          code: "INVALID_OPENS_ON",
        },
        { status: 400 },
      );
    }

    // #256 m9 — matrice des transitions de statut : une transition invalide
    // est refusée en 400 AVANT toute écriture.
    const current = await prisma.exam.findUnique({
      where: { id },
      select: { id: true, status: true, scheduledAt: true, opensOn: true },
    });
    if (!current) {
      return NextResponse.json(
        { message: "Examen non trouvé" },
        { status: 404 },
      );
    }
    const effectiveScheduledAt = scheduledAt
      ? scheduledAtDate
      : scheduledAt === null
        ? null
        : current.scheduledAt;
    // `undefined` = la base ne connaît pas cette information (champ non lu) :
    // l'exigence d'`opensOn` est alors ignorée plutôt que refusée à tort.
    // `null`, en revanche, est une information connue : aucun jour d'ouverture.
    const effectiveOpensOn = hasOpensOnInput ? opensOnDate : current.opensOn;
    const transition = validateExamStatusTransition({
      from: current.status,
      to: status ?? null,
      scheduledAt: effectiveScheduledAt,
      opensOn: effectiveOpensOn,
    });
    if (!transition.ok) {
      return NextResponse.json(
        { message: transition.message, code: transition.code },
        { status: transition.status },
      );
    }

    // Calculate totals for summary fields
    const enabledParts = (parts && Array.isArray(parts)) ? parts.filter(p => p.enabled) : [];
    const totalPoints = enabledParts.reduce((sum: number, p: any) => sum + (parseFloat(p.points?.toString() || "0")), 0);

    // 🏆 ATOMIC UPDATE
    const exam = await prisma.exam.update({
      where: { id },
      data: {
        title,
        name: title, // #130 m8 — title et name restent synchronisés
        description,
        status,
        // PATCH partiel : un champ de planning absent du body n'est jamais
        // remis à `null`.
        scheduledAt: "scheduledAt" in body ? scheduledAtDate : undefined,
        opensOn: hasOpensOnInput ? opensOnDate : undefined,
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
