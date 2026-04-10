import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
       return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        portfolioMissions: {
          include: {
            mission: true,
            proofs: true
          },
          orderBy: {
            mission: { order: "asc" }
          }
        },
        attestations: {
            where: { status: 'VALIDATED' }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Candidat non trouvé" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[ADMIN_PORTFOLIO_DETAIL_GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
       return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, missionUpdates } = body;

    // Mise à jour du statut global du portfolio et éventuellement des missions individuelles
    if (missionUpdates && Array.isArray(missionUpdates)) {
        for (const update of missionUpdates) {
            await prisma.userPortfolioMission.update({
                where: { id: update.id },
                data: {
                    status: update.status,
                    adminComment: update.adminComment
                }
            });
        }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        portfolioStatus: status,
        portfolioEnabled: status === "PUBLISHED"
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("[ADMIN_PORTFOLIO_PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
