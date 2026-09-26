// app/api/exams/scheduled/route.ts
// Public endpoint for scheduled exams - Used for countdown timer display
// Returns only public exam info (no questions/answers)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasOpened, opensOn } from "@/lib/exams/time";
import { VISIBLE_EXAM_STATUSES } from "@/lib/exams/availability";

export async function GET(request: Request) {
  try {
    // #256 m9 — une seule référence temporelle : decisions de visibilité et
    // redaction du contenu futur utilisent le meme « maintenant ».
    const now = new Date();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // Examens encore programmés : annonce publique uniquement.
    // #256 m9 — la route publique ne déclenche AUCUNE mutation (lazy-open
    // retiré) : la bascule SCHEDULED -> PUBLISHED appartient au cron interne.
    // Un examen reste donc listable tant qu'il est SCHEDULED comme PUBLISHED.
    const exams = await prisma.exam.findMany({
      where: {
        status: { in: [...VISIBLE_EXAM_STATUSES] },
        scheduledAt: { not: null },
        type: (type as any) || undefined,
      },
      select: {
        id: true,
        title: true,
        name: true,
        description: true,
        scheduledAt: true,
        opensOn: true,
        duration: true,
        type: true,
        status: true,
      },
      orderBy: {
        scheduledAt: "asc",
      },
    });

    // #256 m9 — cette route est PUBLIQUE (annonces à venir, compte à rebours).
    // Tant que l'examen n'est pas ouvert, la forme est RÉDUITE : les clés de
    // contenu (description, durée) sont ABSENTES, pas nulles — rien ne peut
    // fuiter par une clé oubliée. Seuls l'identité de la session, son type, son
    // statut et ses deux dates de planning sont annoncés.
    const sanitized = exams.map((exam: any) => {
      const opened = hasOpened(exam, now);
      const opensAt = opensOn(exam);
      return {
        id: exam.id,
        title: exam.title,
        name: exam.name,
        scheduledAt: exam.scheduledAt,
        opensOn: opensAt ? opensAt.toISOString() : null,
        opensAt: opensAt ? opensAt.toISOString() : null,
        type: exam.type,
        status: exam.status,
        locked: !opened,
        ...(opened
          ? { description: exam.description, duration: exam.duration }
          : {}),
      };
    });

    return NextResponse.json({ exams: sanitized });
  } catch (error) {
    console.error("Error fetching scheduled exams:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des examens programmés" },
      { status: 500 },
    );
  }
}
