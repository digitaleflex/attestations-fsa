// app/api/admin/exams/[id]/route.ts
// Admin exam update route
import { NextResponse, NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { ExamStatus, ExamType, QuestionType } from "@prisma/client";
import { validateExamStatusTransition } from "@/lib/exams/transitions";

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
      opensOn: opensOnInput,
      parts,
      formationId,
      session,
      duration,
      passingScore,
      randomizeQuestions,
      showResults,
      type,
    } = body;

    // #256 m9 — un PATCH sans aucun champ exploitable n'est pas un no-op : il
    // n'a rien à écrire. On le refuse en 400 plutôt que d'ignorer silencieusement
    // la requête. En revanche, un `status` ABSENT du body laisse le statut
    // inchangé (no-op sur la transition) : seul un `status` présent mais vide ou
    // invalide est un 400.
    const PATCHABLE_FIELDS = [
      "status",
      "name",
      "title",
      "description",
      "scheduledAt",
      "opensOn",
      "parts",
      "formationId",
      "session",
      "duration",
      "passingScore",
      "randomizeQuestions",
      "showResults",
      "type",
    ] as const;
    if (
      !body ||
      typeof body !== "object" ||
      !PATCHABLE_FIELDS.some((field) => field in body)
    ) {
      return NextResponse.json(
        {
          message: "Corps de requête vide : rien à mettre à jour.",
          code: "EMPTY_EXAM_PATCH",
        },
        { status: 400 },
      );
    }

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

    // #256 m9 — `opensOn` (journée d'ouverture) est stocké TEL QUE FOURNI ; sa
    // normalisation au minuit de `APP_TIMEZONE` est faite à la lecture, par
    // `lib/exams/time.ts` (règle unique). Une date illisible est un 400.
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

    // Matrice des transitions de statut : une transition invalide est refusée en
    // 400 AVANT toute écriture. `status` absent du body = inchangé.
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
    const enabledParts = (parts && Array.isArray(parts)) ? parts.filter((p: ExamPartPayload) => p.enabled) : [];
    const totalPoints = enabledParts.reduce((sum: number, p: ExamPartPayload) => sum + (parseFloat(p.points?.toString() || "0")), 0);

    // 🏆 ATOMIC UPDATE (Single DB roundtrip for the entire exam structure)
    const exam = await prisma.exam.update({
      where: { id },
      data: {
        name: name || title,
        title: title,
        description,
        // `status` absent du body = inchangé (no-op sur la transition) : ni
        // écriture ni régression de statut.
        status,
        // `scheduledAt` / `opensOn` : PATCH partiel — un champ absent du body
        // ne doit jamais être remis à `null`.
        scheduledAt: "scheduledAt" in body ? scheduledAtDate : undefined,
        opensOn: hasOpensOnInput ? opensOnDate : undefined,
        formation: formationId ? { connect: { id: formationId } } : undefined,
        session,
        duration: (duration !== undefined && duration !== null) ? parseInt(duration.toString()) : undefined,
        // #123 — arrondi serveur (Math.round) et non troncature (parseInt)
        passingScore: (passingScore !== undefined && passingScore !== null) ? Math.round(Number(passingScore)) : undefined,
        // #130 m6 — PATCH partiel : ne pas écraser les booléens absents du body
        randomizeQuestions: randomizeQuestions === undefined ? undefined : randomizeQuestions === true,
        showResults: showResults === undefined ? undefined : showResults === true,
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

