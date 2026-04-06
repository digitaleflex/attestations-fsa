import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = userSession.id;

    // Récupérer le profil utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        birthDate: true,
        birthPlace: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 },
      );
    }

    // Récupérer les résultats d'examens
    const examSessions = await prisma.examSession.findMany({
      where: { userId },
      include: {
        exam: {
          select: {
            name: true,
            title: true,
            totalPoints: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const examResults = examSessions.map((session: any) => ({
      examName: session.exam.title || session.exam.name,
      score: session.score,
      totalPoints: session.exam.totalPoints || 20,
      status: session.status,
      date: session.submittedAt || session.startedAt,
      part1Score: session.scorePart1,
      part2Score: session.scorePart2,
      part3Score: session.scorePart3,
    }));

    // Récupérer les attestations
    const attestations = await prisma.attestation.findMany({
      where: { userId },
      include: {
        formation: {
          select: { name: true },
        },
      },
      orderBy: { issuedAt: "desc" },
    });

    const attestationData = attestations.map((att: any) => ({
      formationName: att.formation?.name || "Formation",
      type: att.type,
      code: att.code,
      issuedAt: att.issuedAt,
      score: att.certificationScore || att.stageScore || undefined,
    }));

    // Calculer les statistiques
    const totalExams = examSessions.length;
    const passedExams = examSessions.filter((s: any) => {
      const percentage = (s.score / (s.exam.totalPoints || 20)) * 100;
      return percentage >= 60;
    }).length;
    const successRate =
      totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0;

    // Calculer la moyenne globale (sur 100)
    const globalAverage =
      examSessions.length > 0
        ? examSessions.reduce((acc: number, session: any) => {
            const maxScore = session.exam.totalPoints || 20;
            const percentage = (session.score / maxScore) * 100;
            return acc + percentage;
          }, 0) / examSessions.length
        : 0;

    return NextResponse.json({
      user: {
        fullName: user.name || "Candidat",
        birthDate: user.birthDate,
        birthPlace: user.birthPlace || "Non spécifié",
        email: user.email || "",
      },
      examResults,
      attestations: attestationData,
      stats: {
        globalAverage: Math.round(globalAverage),
        totalExams,
        passedExams,
        successRate,
      },
    });
  } catch (error: unknown) {
    console.error("Erreur transcript:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
