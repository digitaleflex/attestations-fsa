import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const missionsStatus = await prisma.userPortfolioMission.findMany({
      where: { userId: user.id }
    });

    const totalMissions = await prisma.portfolioMission.count();
    const completedMissions = missionsStatus.filter((m: any) => m.status === "COMPLETED").length;

    if (completedMissions < totalMissions) {
      return NextResponse.json({ 
        error: "Vous devez compléter toutes les missions avant de demander une validation." 
      }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        portfolioStatus: "PENDING_VALIDATION"
      }
    });

    return NextResponse.json(updatedUser);

  } catch (error) {
    console.error("[PORTFOLIO_VALIDATE_POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
