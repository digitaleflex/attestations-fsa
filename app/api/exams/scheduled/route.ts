// app/api/exams/scheduled/route.ts
// Public endpoint for scheduled exams - Used for countdown timer display
// Returns only public exam info (no questions/answers)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autoOpenDueExams } from "@/lib/exams/availability";
import { hasOpened, opensOn } from "@/lib/exams/time";

export async function GET(request: Request) {
  try {
    // #256 m9 — une seule référence temporelle : decisions de visibilité et
    // redaction du contenu futur utilisent le meme « maintenant ».
    const now = new Date();

    // Ouvre paresseusement les examens SCHEDULED dont l'heure est atteinte.
    await autoOpenDueExams(now);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // Examens encore programmés : annonce publique uniquement.
    const exams = await prisma.exam.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { not: null },
        type: (type as any) || undefined,
      },
      select: {
        id: true,
        title: true,
        name: true,
        description: true,
        scheduledAt: true,
        duration: true,
        type: true,
        status: true,
      },
      orderBy: {
        scheduledAt: "asc",
      },
    });

    // #256 m9 — cette route est PUBLIQUE (annonces à venir, compte à rebours).
    // Tant que le jour J n'est pas atteint, aucun contenu d'examen ne sort :
    // ni description, ni durée, ni barème. Seuls l'identité de la session et
    // sa date d'ouverture sont annoncés.
    const sanitized = exams.map((exam: any) => {
      const opened = hasOpened(exam, now);
      return {
        id: exam.id,
        title: exam.title,
        name: exam.name,
        description: opened ? exam.description : null,
        duration: opened ? exam.duration : null,
        scheduledAt: exam.scheduledAt,
        opensAt: (opensOn(exam) ?? null)?.toISOString() ?? null,
        type: exam.type,
        status: exam.status,
        locked: !opened,
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
