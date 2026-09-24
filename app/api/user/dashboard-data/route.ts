import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { AttestationStatus, AttestationType } from '@prisma/client';
import {
  round2,
  isCorrected,
  resolveExamMax,
  computeFinalScore,
  isPassed,
} from '@/lib/exams/scoring';

/** Mapping d'affichage canonique des statuts de session. */
function displayStatus(status: string): 'COMPLETED' | 'SUBMITTED' | 'IN_PROGRESS' {
  if (isCorrected(status)) return 'COMPLETED';
  if (status === 'PENDING_REVIEW') return 'SUBMITTED';
  return 'IN_PROGRESS';
}

interface ScoringExam {
  totalPoints: number;
  part1Points?: number | null;
  part2Points?: number | null;
  part3Points?: number | null;
  part1Enabled?: boolean | null;
  part2Enabled?: boolean | null;
  part3Enabled?: boolean | null;
  passingScore: number | null;
}

interface ScoringSession {
  totalScore: number;
  finalScore: number;
  status: string;
  exam: ScoringExam | null;
}

/** Pourcentage canonique d'une session corrigée (via finalScore, fallback points bruts). */
function resolveSessionFinalScore(session: ScoringSession): number | null {
  if (!isCorrected(session.status)) return null;
  if (typeof session.finalScore === 'number' && session.finalScore > 0) {
    return round2(session.finalScore);
  }
  const maxScore = resolveExamMax(session.exam ?? {});
  return computeFinalScore(session.totalScore, maxScore);
}

function isSessionPassed(session: ScoringSession): boolean {
  const finalScore = resolveSessionFinalScore(session);
  return finalScore !== null && isPassed(finalScore, session.exam?.passingScore);
}

export async function GET(request: Request) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = userSession.id;

    // Lancer toutes les requêtes en parallèle (une seule requête d'auth, parallélisation Prisma complète)
    const [
      profile,
      attestations,
      examSessions,
      availableExams,
      detailedSubmissions,
      notifications,
      unreadNotificationsCount,
      userEmailObj
    ] = await Promise.all([
      // 1. Profil
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          birthDate: true,
          birthPlace: true,
          phone: true,
          address: true,
          role: true,
          gender: true,
          emailVerified: true,
          createdAt: true,
          examId: true,
          reclamations: {
            where: { type: "CORRECTION", status: 'PENDING' },
            take: 1
          }
        }
      }),
      // 2. Attestations
      prisma.attestation.findMany({
        where: { userId },
        include: {
          formation: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
        take: 5
      }),
      // 3. Sessions d'examen pour les statistiques d'aperçu
      prisma.examSession.findMany({
        where: { userId },
        select: {
          totalScore: true,
          finalScore: true,
          status: true,
          submittedAt: true,
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
      // 4. Examens disponibles
      prisma.exam.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          name: true,
          description: true,
          totalPoints: true,
          passingScore: true,
          duration: true,
          part1Questions: true,
          part2Questions: true,
          part3Enabled: true,
          type: true,
        },
      }),
      // 5. Soumissions détaillées
      prisma.examSession.findMany({
        where: { userId },
        select: {
          id: true,
          examId: true,
          totalScore: true,
          finalScore: true,
          submittedAt: true,
          status: true,
          answers: true,
          exam: {
            select: {
              title: true,
              name: true,
              description: true,
              totalPoints: true,
              part1Points: true,
              part2Points: true,
              part3Points: true,
              part1Enabled: true,
              part2Enabled: true,
              part3Enabled: true,
              passingScore: true,
              duration: true,
              part1Questions: true,
              part2Questions: true,
              type: true,
            },
          },
        },
      }),
      // 6. Notifications
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
      // 8. E-mail de l'utilisateur pour les stages
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })
    ]);

    if (!profile) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Récupérer les demandes de stage si l'email existe
    let internshipApplications: Array<{ status: string }> = [];
    if (userEmailObj?.email) {
      internshipApplications = await prisma.internshipRequest.findMany({
        where: { email: userEmailObj.email },
        select: { status: true }
      });
    }

    // --- FORMATEURS EN MÉMOIRE ---

    // A. Formater les attestations (gestion verrouillage et masquage du code)
    const attFormationIds = attestations.map(a => a.formationId).filter(Boolean);
    const attSessions = await prisma.examSession.findMany({
      where: {
        userId,
        exam: {
          formationId: { in: attFormationIds as string[] },
          type: 'OFFICIAL',
        },
      },
      include: {
        exam: {
          select: {
            formationId: true,
            showResults: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    const enhancedAttestations = attestations.map((att: any) => {
      const session = attSessions.find(s => s.exam.formationId === att.formationId);
      const isLocked = session ? !session.exam.showResults : false;
      const isPublic = (att.status === 'VALIDATED' || att.status === 'CLAIMED') && !isLocked;
      return {
        ...att,
        isLocked,
        code: isPublic ? att.code : '••••-••••-••••',
      };
    });

    const attStats = {
      total: attestations.length,
      validated: enhancedAttestations.filter((a: any) => a.status === 'VALIDATED' && !a.isLocked).length,
      pending: enhancedAttestations.filter((a: any) => a.status === 'PENDING' || (a.status === 'VALIDATED' && a.isLocked)).length,
      rejected: enhancedAttestations.filter((a: any) => a.status === 'REJECTED').length,
    };

    // B. Formater les examens (disponibles et complétés)
    const submittedExamIds = new Set(detailedSubmissions.map(s => s.examId));

    const completedExamsFormatted = detailedSubmissions.map((sub) => {
      const exam = sub.exam;
      const qCount = exam.part1Questions + exam.part2Questions + (exam.part3Enabled ? 1 : 0);
      const customBareme = sub.answers && typeof sub.answers === 'object' ? (sub.answers as any)._customBareme : null;
      const maxScore = customBareme?.totalMax ?? resolveExamMax(exam);

      const isDone = isCorrected(sub.status);
      const hasFinalScore = typeof sub.finalScore === 'number' && sub.finalScore > 0;
      const finalScore = isDone
        ? hasFinalScore
          ? round2(sub.finalScore)
          : computeFinalScore(sub.totalScore, maxScore)
        : null;
      const passingScore = exam.passingScore ?? 65;

      return {
        id: sub.examId,
        submissionId: sub.id,
        examName: exam.title || exam.name,
        examDescription: exam.description,
        status: displayStatus(sub.status),
        score: sub.totalScore,
        maxScore: maxScore,
        finalScore,
        passingScore,
        passed: isDone && finalScore !== null && isPassed(finalScore, passingScore),
        startedAt: sub.submittedAt,
        completedAt: sub.submittedAt,
        duration: `${Math.round(exam.duration / 60)} minutes`,
        questionCount: qCount,
        type: exam.type,
      };
    });

    const availableExamsFormatted = availableExams
      .filter((exam: any) => !submittedExamIds.has(exam.id))
      .filter((exam: any) => !profile.examId || profile.examId === exam.id)
      .map((exam: any) => ({
        id: exam.id,
        examName: exam.title || exam.name,
        examDescription: exam.description,
        status: 'AVAILABLE',
        score: 0,
        maxScore: exam.totalPoints || 100,
        finalScore: null,
        passingScore: exam.passingScore ?? 65,
        passed: false,
        startedAt: null,
        completedAt: null,
        duration: `${Math.round(exam.duration / 60)} minutes`,
        questionCount: exam.part1Questions + exam.part2Questions + (exam.part3Enabled ? 1 : 0),
        type: exam.type,
      }));

    const examsResult = [...completedExamsFormatted, ...availableExamsFormatted];

    const examsStats = {
      total: examsResult.length,
      completed: examsResult.filter(e => e.status === 'COMPLETED').length,
      inProgress: examsResult.filter(e => e.status === 'IN_PROGRESS').length,
      available: examsResult.filter(e => e.status === 'AVAILABLE').length,
      passed: examsResult.filter(e => e.status === 'COMPLETED' && e.passed === true).length,
    };

    // C. Calculer les statistiques globales
    const validAttestations = attestations.filter(a => a.status === 'VALIDATED');
    const attestationsCount = validAttestations.length;

    const officialExams = examSessions.filter(s => s.exam?.type === 'OFFICIAL');
    const mockExams = examSessions.filter(s => s.exam?.type === 'MOCK');

    // Seules les sessions corrigées comptent comme réussies/échouées.
    const officialCorrected = officialExams.filter((s) => isCorrected(s.status));
    const mockCorrected = mockExams.filter((s) => isCorrected(s.status));

    const examsCompletedCount = officialCorrected.length;
    const examsPassedCount = officialCorrected.filter(isSessionPassed).length;

    const mockExamsCompletedCount = mockCorrected.length;
    const mockExamsPassedCount = mockCorrected.filter(isSessionPassed).length;

    const averageScore = examsCompletedCount > 0
      ? Math.round(
          officialCorrected.reduce(
            (sum, sub) => sum + (resolveSessionFinalScore(sub) ?? 0),
            0,
          ) / examsCompletedCount,
        )
      : 0;

    const internshipsApplied = internshipApplications.length;
    const internshipsAccepted = internshipApplications.filter(i => i.status === 'ACCEPTED').length;

    // Progression mensuelle
    const now = new Date();
    const monthlyProgression = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(now.getMonth() - i);
      const m = monthDate.getMonth();
      const y = monthDate.getFullYear();

      const count = validAttestations.filter(a => {
        const d = new Date(a.issuedAt);
        return d.getMonth() === m && d.getFullYear() === y;
      }).length;

      monthlyProgression.push({
        month: monthDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        attestations: count,
      });
    }

    const badges = [];
    if (attestationsCount >= 1) badges.push({ id: 'first_cert', name: 'Premier Certificat', icon: '🎓' });
    if (attestationsCount >= 5) badges.push({ id: 'five_certs', name: '5 Certificats', icon: '🏆' });
    if (examsPassedCount >= 1) badges.push({ id: 'first_exam', name: 'Premier Examen Réussi', icon: '✅' });
    if (mockExamsPassedCount >= 1) badges.push({ id: 'first_mock', name: 'Entraînement Actif', icon: '🧠' });
    if (averageScore >= 90) badges.push({ id: 'excellence', name: 'Excellence', icon: '⭐' });

    return NextResponse.json({
      profile,
      attestations: {
        attestations: enhancedAttestations,
        stats: attStats
      },
      exams: {
        exams: examsResult,
        stats: examsStats
      },
      notifications: {
        notifications,
        unreadCount: unreadNotificationsCount
      },
      statistics: {
        overview: {
          memberSince: profile.createdAt,
          totalAttestations: attestationsCount,
          totalExams: examsCompletedCount,
          examsPassed: examsPassedCount,
          totalMockExams: mockExamsCompletedCount,
          mockExamsPassed: mockExamsPassedCount,
          averageScore,
          totalInternships: internshipsApplied,
          internshipsAccepted,
        },
        monthlyProgression,
        badges,
      }
    });

  } catch (error: unknown) {
    console.error('Erreur API dashboard-data:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
