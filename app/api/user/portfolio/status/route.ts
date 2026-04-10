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
          { formationId: null }
        ]
      },
      orderBy: { order: "asc" },
      include: {
        formation: { select: { name: true } },
        userMissions: {
          where: { userId: user.id },
          include: { 
            proofs: true 
          }
        }
      }
    });

    // Récupérer les scores des examens pour les prérequis
    const userExamSessions = await prisma.examSession.findMany({
      where: { userId: user.id, status: "GRADED" },
      select: {
        examId: true,
        finalScore: true,
        exam: { select: { totalPoints: true } }
      }
    });

    const missionsWithStatus = currentMissions.map((m: any) => {
      const userMission = m.userMissions[0];
      let status = userMission?.status || "PENDING";
      let unlockedLevel = "STANDARD";
      let lockReason = null;

      // Logique de déblocage pour les projets
      if (m.type === "PROJECT" && m.requiredExamId) {
        const session = userExamSessions.find((s: any) => s.examId === m.requiredExamId);
        if (!session) {
          status = "LOCKED";
          lockReason = "Examen prérequis non complété";
        } else {
          const normalizedScore = (session.finalScore / (session.exam.totalPoints || 100)) * 20;
          if (normalizedScore < (m.minScoreRequired || 13)) {
            status = "LOCKED";
            lockReason = `Score insuffisant (${normalizedScore.toFixed(1)}/20). Minimum: ${m.minScoreRequired || 13}/20`;
          } else if (normalizedScore >= 16) {
            unlockedLevel = "ADVANCED";
          }
        }
      }

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        guideMarkdown: m.guideMarkdown,
        order: m.order,
        dueDate: m.dueDate,
        formationName: m.formation?.name || null,
        userStatus: status,
        unlockedLevel: userMission?.unlockedLevel || unlockedLevel,
        submissionProof: userMission?.submissionProof || null,
        adminComment: userMission?.adminComment || null,
        completedAt: userMission?.completedAt || null,
        proofs: userMission?.proofs || [],
        lockReason
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
