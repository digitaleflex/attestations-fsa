import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  round2,
  isCorrected,
  resolveExamMax,
  computeFinalScore,
  isPassed,
} from "@/lib/exams/scoring";

interface ScoringExam {
  passingScore: number | null;
  totalPoints: number;
  part1Points?: number | null;
  part2Points?: number | null;
  part3Points?: number | null;
  part1Enabled?: boolean | null;
  part2Enabled?: boolean | null;
  part3Enabled?: boolean | null;
  type?: string | null;
}

interface SubmissionWithExam {
  totalScore: number;
  finalScore: number;
  status: string;
  type?: string | null;
  submittedAt: Date | null;
  exam: ScoringExam | null;
}

/** Pourcentage canonique d'une session corrigée (via finalScore, fallback points bruts). */
function resolveSessionFinalScore(sub: SubmissionWithExam): number | null {
  if (!isCorrected(sub.status)) return null;
  if (typeof sub.finalScore === "number" && sub.finalScore > 0) {
    return round2(sub.finalScore);
  }
  const maxScore = resolveExamMax(sub.exam ?? {});
  return computeFinalScore(sub.totalScore, maxScore);
}

function isSessionPassed(sub: SubmissionWithExam): boolean {
  const finalScore = resolveSessionFinalScore(sub);
  return finalScore !== null && isPassed(finalScore, sub.exam?.passingScore);
}

export async function GET(request: Request) {
  try {
    const userAuth = await getCurrentUser(request);
    if (!userAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = userAuth.id;

    // ÉTAPE 1 : Requêtes de base en PARALLÈLE
    const [user, allUserAttestations, examSubmissions, internshipApplications, recentExams] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true, createdAt: true },
        }),
        prisma.attestation.findMany({
          where: { userId: userId },
          select: { id: true, status: true, issuedAt: true },
        }),
        prisma.examSession.findMany({
          where: { userId: userId },
          select: {
            totalScore: true,
            finalScore: true,
            status: true,
            submittedAt: true,
            type: true,
            exam: {
              select: {
                passingScore: true,
                totalPoints: true,
                part1Points: true,
                part2Points: true,
                part3Points: true,
                part1Enabled: true,
                part2Enabled: true,
                part3Enabled: true,
                type: true,
              },
            },
          },
        }),
        prisma.user
          .findUnique({
            where: { id: userId },
            select: { email: true },
          })
          .then((u: { email: string | null } | null) =>
            u?.email
              ? prisma.internshipRequest.findMany({
                  where: { email: u.email },
                  select: { status: true },
                })
              : [],
          ),
        prisma.examSession.findMany({
          where: { userId: userId },
          orderBy: { submittedAt: 'desc' },
          take: 3,
          select: {
            id: true,
            totalScore: true,
            submittedAt: true,
            status: true,
            exam: { select: { title: true, totalPoints: true } }
          }
        })
      ]);

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 },
      );
    }

    // ÉTAPE 2 : Calculs Statistiques en MÉMOIRE (Ultra-rapide)
    const validAttestations = allUserAttestations.filter(
      (a: { status: string }) => a.status === "VALIDATED",
    );
    const attestationsCount = validAttestations.length;

    const officialExams = (examSubmissions as unknown as SubmissionWithExam[]).filter((s) => s.exam?.type === 'OFFICIAL' || s.type === 'OFFICIAL');
    const mockExams = (examSubmissions as unknown as SubmissionWithExam[]).filter((s) => s.exam?.type === 'MOCK' || s.type === 'MOCK');

    // Seules les sessions corrigées sont comptabilisées comme réussies/échouées.
    const officialCorrected = officialExams.filter((s) => isCorrected(s.status));
    const mockCorrected = mockExams.filter((s) => isCorrected(s.status));

    const examsCompleted = officialCorrected.length;
    const examsPassed = officialCorrected.filter(isSessionPassed).length;

    const mockExamsCompleted = mockCorrected.length;
    const mockExamsPassed = mockCorrected.filter(isSessionPassed).length;

    const averageScore =
      examsCompleted > 0
        ? Math.round(
            officialCorrected.reduce(
              (sum, sub) => sum + (resolveSessionFinalScore(sub) ?? 0),
              0,
            ) / examsCompleted,
          )
        : 0;

    const internshipsApplied = internshipApplications.length;
    const internshipsAccepted = internshipApplications.filter(
      (i: { status: string }) => i.status === "ACCEPTED",
    ).length;

    // Activité récente et progression mensuelle
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const recentActivity = {
      attestationsLast7Days: validAttestations.filter(
        (a: { issuedAt: Date | null }) =>
          a.issuedAt && new Date(a.issuedAt) >= sevenDaysAgo,
      ).length,
      examsLast7Days: examSubmissions.filter(
        (e: { submittedAt: Date | null }) =>
          e.submittedAt && new Date(e.submittedAt) >= sevenDaysAgo,
      ).length,
    };

    // Progression par mois (6 derniers mois) calculée en une seule boucle
    const monthlyProgression = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(now.getMonth() - i);

      const m = monthDate.getMonth();
      const y = monthDate.getFullYear();

      const count = validAttestations.filter((a: { issuedAt: Date }) => {
        const d = new Date(a.issuedAt);
        return d.getMonth() === m && d.getFullYear() === y;
      }).length;

      monthlyProgression.push({
        month: monthDate.toLocaleDateString("fr-FR", {
          month: "short",
          year: "numeric",
        }),
        attestations: count,
      });
    }

    // Badges
    const badges = [];
    if (attestationsCount >= 1)
      badges.push({ id: "first_cert", name: "Premier Certificat", icon: "🎓" });
    if (attestationsCount >= 5)
      badges.push({ id: "five_certs", name: "5 Certificats", icon: "🏆" });
    if (examsPassed >= 1)
      badges.push({
        id: "first_exam",
        name: "Premier Examen Réussi",
        icon: "✅",
      });
    if (mockExamsPassed >= 1)
      badges.push({
        id: "first_mock",
        name: "Entraînement Actif",
        icon: "🧠",
      });
    if (averageScore >= 90)
      badges.push({ id: "excellence", name: "Excellence", icon: "⭐" });

    return NextResponse.json({
      overview: {
        memberSince: user.createdAt,
        totalAttestations: attestationsCount,
        totalExams: examsCompleted,
        examsPassed,
        totalMockExams: mockExamsCompleted,
        mockExamsPassed,
        averageScore,
        totalInternships: internshipsApplied,
        internshipsAccepted,
      },
      recentActivity,
      monthlyProgression,
      badges,
      recentExams
    });
  } catch (err: unknown) {
    console.error("Erreur statistiques user:", err);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 },
    );
  }
}
