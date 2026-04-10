import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";

// Ajouter ou mettre à jour une preuve (lien)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { missionId, label, url, type, proofId } = body;

    if (!missionId || !label || !url) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    // Trouver ou créer l'UserPortfolioMission
    let userMission = await prisma.userPortfolioMission.findUnique({
      where: { userId_missionId: { userId: user.id, missionId } }
    });

    if (!userMission) {
      userMission = await prisma.userPortfolioMission.create({
        data: { userId: user.id, missionId, status: "IN_PROGRESS" }
      });
    }

    if (proofId) {
      // Mise à jour d'un lien existant
      const updated = await prisma.portfolioProof.update({
        where: { id: proofId },
        data: { label, url, type: type || "LINK" }
      });
      return NextResponse.json(updated);
    } else {
      // Création d'un nouveau lien
      const proof = await prisma.portfolioProof.create({
        data: {
          userMissionId: userMission.id,
          label,
          url,
          type: type || "LINK"
        }
      });

      // Déclencher une notification pour les admins
      try {
        await pusherServer.trigger("admin-updates", "new-proof", {
          candidateName: user.name || "Un candidat",
          missionId: missionId,
          label: label,
          url: url
        });
      } catch (pusherErr) {
        console.error("Pusher proof notification error:", pusherErr);
      }

      return NextResponse.json(proof);
    }
  } catch (error) {
    console.error("[PORTFOLIO_PROOFS_POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Supprimer une preuve
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    // Vérifier que la preuve appartient bien à l'utilisateur
    const proof = await prisma.portfolioProof.findUnique({
      where: { id },
      include: { userMission: true }
    });

    if (!proof || proof.userMission.userId !== user.id) {
      return NextResponse.json({ error: "Preuve introuvable ou non autorisée" }, { status: 404 });
    }

    await prisma.portfolioProof.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PORTFOLIO_PROOFS_DELETE]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
