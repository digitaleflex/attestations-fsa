// app/api/exams/scheduled/route.ts
// Public endpoint for scheduled exams - Used for countdown timer display
// Returns only public exam info (no questions/answers)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // Fetch only scheduled exams with public info
    const exams = await prisma.exam.findMany({
      where: {
        status: "SCHEDULED",
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

    // Filter out exams without scheduledAt
    const upcomingExams = exams.filter(
      (exam: { scheduledAt: Date | null }) =>
        exam.scheduledAt && new Date(exam.scheduledAt) > new Date(),
    );

    return NextResponse.json({ exams: upcomingExams });
  } catch (error) {
    console.error("Error fetching scheduled exams:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des examens programmés" },
      { status: 500 },
    );
  }
}
