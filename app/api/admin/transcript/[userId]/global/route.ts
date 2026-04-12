import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { userId } = await params;

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

    // Récupérer les résultats d'examens (Tous: Officiels + Blancs)
    const examSessions = await prisma.examSession.findMany({
      where: { userId },
      include: {
        exam: {
          select: {
            name: true,
            title: true,
            totalPoints: true,
            type: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const examResults = examSessions.map((session: any) => {
      const customBareme = session.answers && typeof session.answers === 'object' 
        ? (session.answers as any)._customBareme 
        : null;
      
      const totalPoints = customBareme?.totalMax ?? (session.exam.totalPoints || 100);

      return {
        id: session.id,
        examName: session.exam.title || session.exam.name,
        score: session.score,
        totalPoints,
        internshipScore: session.internshipScore,
        finalScore: session.finalScore,
        status: session.status,
        type: session.exam.type,
        date: session.submittedAt || session.startedAt,
        part1Score: session.scorePart1,
        part2Score: session.scorePart2,
        part3Score: session.scorePart3,
        maxPart1: customBareme?.maxPart1 || 20,
        maxPart2: customBareme?.maxPart2 || 40,
        maxPart3: customBareme?.maxPart3 || 40,
      };
    });

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

    // Calculer les statistiques (UNIQUEMENT sur les examens OFFICIELS)
    const officialSessions = examSessions.filter((s: any) => s.exam.type === "OFFICIAL");
    
    const totalExams = officialSessions.length;
    const passedExams = officialSessions.filter((s: any) => {
      const customBareme = s.answers && typeof s.answers === 'object' 
        ? (s.answers as any)._customBareme 
        : null;
      const maxPoints = customBareme?.totalMax ?? ((s.exam as any).totalPoints || 100);
      const percentage = s.finalScore || (s.score / maxPoints) * 100;
      return percentage >= 65;
    }).length;
    
    const successRate = totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0;

    const globalAverage = officialSessions.length > 0
        ? officialSessions.reduce((acc: number, session: any) => {
            const customBareme = session.answers && typeof session.answers === 'object' 
              ? (session.answers as any)._customBareme 
              : null;
            const maxPoints = customBareme?.totalMax ?? ((session.exam as any).totalPoints || 100);
            const percentage = session.finalScore || (session.score / maxPoints) * 100;
            return acc + percentage;
          }, 0) / officialSessions.length
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
    console.error("Erreur Relevé Global Admin:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
