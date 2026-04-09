import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { portfolioStatus: true, formationId: true }
    });

    // Lazy seeding : Si aucune mission, on crée les missions par défaut pour l'utilisateur
    // En production, vous feriez cela lors de l'inscription ou via un script global,
    // mais ici c'est plus pratique pour le test.
    const allMissions = await prisma.portfolioMission.findMany({ orderBy: { order: "asc" } });
    
    // Si la table global des missions est vide, on en crée quelques-unes par défaut
    if (allMissions.length === 0) {
      const formations = await prisma.formation.findMany({ take: 2 });
      await prisma.portfolioMission.createMany({
        data: [
          { title: "Profil complet", description: "Remplissez toutes vos informations personnelles.", order: 1, formationId: dbUser?.formationId || formations[0]?.id },
          { title: "Examen de validation", description: "Réussir l'examen lié à votre formation.", order: 2, formationId: dbUser?.formationId || formations[0]?.id },
          { title: "Rapport de stage", description: "Soumettre votre synthèse de stage pratique.", order: 3, formationId: dbUser?.formationId || formations[0]?.id },
          { title: "Bio Professionnelle", description: "Décrivez vos ambitions.", order: 4, formationId: dbUser?.formationId || formations[1]?.id || dbUser?.formationId },
        ]
      });
    }

    const currentMissions = await prisma.portfolioMission.findMany({
      where: {
        OR: [
          { formationId: dbUser?.formationId },
          { formationId: null } // Missions communes éventuelles
        ]
      },
      orderBy: { order: "asc" },
      include: {
        formation: { select: { name: true } },
        userMissions: {
          where: { userId: user.id }
        }
      }
    });

    const missionsWithStatus = currentMissions.map((m: any) => {
      const userMission = m.userMissions[0];
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        order: m.order,
        formationName: m.formation?.name || null,
        userStatus: userMission?.status || "PENDING",
        submissionProof: userMission?.submissionProof || null,
        adminComment: userMission?.adminComment || null,
        completedAt: userMission?.completedAt || null
      };
    });

    return NextResponse.json({
      status: dbUser?.portfolioStatus || "DRAFT",
      missions: missionsWithStatus
    });

  } catch (error) {
    console.error("[PORTFOLIO_STATUS_GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
