import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ missionId: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { missionId } = await params;
    const { proof } = await request.json();

    if (!proof) return NextResponse.json({ error: "Preuve requise" }, { status: 400 });

    const updated = await prisma.userPortfolioMission.upsert({
      where: {
        userId_missionId: {
          userId: user.id,
          missionId: missionId
        }
      },
      update: {
        submissionProof: proof,
        status: "COMPLETED", // Pour l'instant on auto-valide la mission au dépôt
        completedAt: new Date()
      },
      create: {
        userId: user.id,
        missionId: missionId,
        submissionProof: proof,
        status: "COMPLETED",
        completedAt: new Date()
      }
    });

    return NextResponse.json(updated);

  } catch (error: unknown) {
    console.error("[PORTFOLIO_MISSION_POST]", error);
    return NextResponse.json({ error: "Erreur serveur", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
