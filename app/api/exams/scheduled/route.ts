// app/api/exams/scheduled/route.ts
// Public endpoint for scheduled exams - Used for countdown timer display
// Returns only public exam info (no questions/answers)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autoOpenDueExams } from "@/lib/exams/availability";

export async function GET(request: Request) {
  try {
    // Ouvre paresseusement les examens SCHEDULED dont l'heure est atteinte.
    await autoOpenDueExams();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // Fetch only still-scheduled exams with public info (annonce à venir)
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
      },
      orderBy: {
        scheduledAt: "asc",
      },
    });

    return NextResponse.json({ exams });
  } catch (error) {
    console.error("Error fetching scheduled exams:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des examens programmés" },
      { status: 500 },
    );
  }
}
