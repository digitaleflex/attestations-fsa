import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExamType, ExamSession, Attestation } from "@/types";

interface ExamResult {
  id: string;
  examName: string;
  score: number;
  totalPoints: number;
  internshipScore: number;
  finalScore: number;
  status: string;
  type: ExamType;
  date: Date | string;
  part1Score?: number;
  part2Score?: number;
  part3Score?: number;
  maxPart1?: number;
  maxPart2?: number;
  maxPart3?: number;
  transcriptDownloadedAt?: string | Date | null;
}

interface AttestationData {
  formationName: string;
  type: string;
  code: string;
  issuedAt: Date | string;
  score?: number;
}

export async function GET(request: Request) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    
    // Si un userId est fourni, on vérifie si l'utilisateur est admin ou s'il demande son propre relevé
    let userId = userSession.id;
    if (targetUserId && targetUserId !== userSession.id) {
      if (userSession.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      userId = targetUserId;
    }

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
            type: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const examResults: ExamResult[] = examSessions.map((session: any) => {
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
        part1Score: (session as any).scorePart1,
        part2Score: (session as any).scorePart2,
        part3Score: (session as any).scorePart3,
        maxPart1: customBareme?.maxPart1 || 20,
        maxPart2: customBareme?.maxPart2 || 40,
        maxPart3: customBareme?.maxPart3 || 40,
        transcriptDownloadedAt: session.transcriptDownloadedAt,
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

    const attestationData: AttestationData[] = attestations.map((att: any) => ({
      formationName: att.formation?.name || "Formation",
      type: att.type,
      // Sécurité : Ne pas exposer le code si l'attestation n'est pas validée
      code: (att.status === "VALIDATED" || att.status === "CLAIMED") ? att.code : "EN ATTENTE",
      issuedAt: att.issuedAt,
      score: att.certificationScore || att.stageScore || undefined,
    }));

    // Calculer les statistiques (UNIQUEMENT sur les examens OFFICIELS)
    const officialSessions = examSessions.filter((s: any) => s.exam.type === "OFFICIAL");
    
    const totalExams = officialSessions.length;
    const passedExams = officialSessions.filter((s: any) => {
      // On utilise le finalScore (moyenne exam+stage) si disponible
      const customBareme = s.answers && typeof s.answers === 'object' 
        ? (s.answers as any)._customBareme 
        : null;
      const maxPoints = customBareme?.totalMax ?? ((s.exam as any).totalPoints || 100);
      const percentage = s.finalScore || (s.score / maxPoints) * 100;
      return percentage >= 65; // Seuil FSA à 65%
    }).length;
    
    const successRate =
      totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0;

    // Calculer la moyenne globale (sur 100) - UNIQUEMENT OFFICIELS
    const globalAverage =
      officialSessions.length > 0
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
      isOwner: userSession.id === userId,
    });
  } catch (error: unknown) {
    console.error("Erreur transcript:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
