import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExamType } from "@/types";
import {
  round2,
  isCorrected,
  resolveExamMax,
  computeFinalScore,
  isPassed,
} from "@/lib/exams/scoring";

interface CustomBareme {
  totalMax?: number;
  maxPart1?: number;
  maxPart2?: number;
  maxPart3?: number;
}

interface ExamResult {
  id: string;
  examName: string;
  /** Conservé pour compatibilité UI : points bruts (remplace l'ancien alias legacy). */
  score: number;
  totalScore: number;
  totalPoints: number;
  internshipScore: number;
  finalScore: number | null;
  passingScore: number;
  passed: boolean;
  status: string;
  type: ExamType;
  date: Date | string;
  part1Score?: number;
  part2Score?: number | null;
  part3Score?: number | null;
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
      if (userSession.role?.toLowerCase() !== "admin") {
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
            part1Points: true,
            part2Points: true,
            part3Points: true,
            part1Enabled: true,
            part2Enabled: true,
            part3Enabled: true,
            passingScore: true,
            showResults: true,
            type: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const enriched = examSessions.map((session) => {
      const answers = session.answers as { _customBareme?: CustomBareme } | null;
      const customBareme = answers?._customBareme ?? null;

      const maxScore = customBareme?.totalMax ?? resolveExamMax(session.exam);
      const passingScore = session.exam.passingScore ?? 65;
      const isDone = isCorrected(session.status);
      const hasFinalScore =
        typeof session.finalScore === "number" && session.finalScore > 0;

      // finalScore = pourcentage 0..100 ; fallback calculé sur les points bruts.
      const finalScore = isDone
        ? hasFinalScore
          ? round2(session.finalScore)
          : computeFinalScore(session.totalScore, maxScore)
        : null;

      const passed =
        isDone && finalScore !== null && isPassed(finalScore, passingScore);

      return { session, customBareme, maxScore, passingScore, finalScore, isDone, passed };
    });

    const examResults: ExamResult[] = enriched.map(
      ({ session, customBareme, maxScore, passingScore, finalScore, passed }) => ({
        id: session.id,
        examName: session.exam.title || session.exam.name,
        // On ne lit plus le champ legacy `score` : on expose les points bruts canoniques.
        score: session.totalScore,
        totalScore: session.totalScore,
        totalPoints: maxScore,
        internshipScore: session.internshipScore,
        finalScore,
        passingScore,
        passed,
        status: session.status,
        type: session.exam.type,
        date: session.submittedAt || session.startedAt,
        part1Score: session.scorePart1,
        part2Score: session.scorePart2,
        part3Score: session.scorePart3,
        maxPart1: customBareme?.maxPart1 ?? session.exam.part1Points ?? 20,
        maxPart2: customBareme?.maxPart2 ?? session.exam.part2Points ?? 40,
        maxPart3: customBareme?.maxPart3 ?? session.exam.part3Points ?? 40,
        transcriptDownloadedAt: session.transcriptDownloadedAt,
      }),
    );

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

    // Statistiques (UNIQUEMENT sur les examens OFFICIELS corrigés)
    const officialCorrected = enriched.filter(
      (entry) => entry.session.exam.type === "OFFICIAL" && entry.isDone,
    );

    const totalExams = officialCorrected.length;
    const passedExams = officialCorrected.filter((entry) => entry.passed).length;

    const successRate =
      totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0;

    const globalAverage =
      totalExams > 0
        ? officialCorrected.reduce(
            (acc, entry) => acc + (entry.finalScore ?? 0),
            0,
          ) / totalExams
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
