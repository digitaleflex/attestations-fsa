import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { handleApiError, ApiErrorImpl } from '@/lib/error-handler';
import { emailService } from '@/lib/email';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';
import { pusherServer } from '@/lib/pusher';
import {
  computeFinalScore,
  isPassed,
  resolveExamMax,
  round2,
} from '@/lib/exams/scoring';
import { issueExamAttestation } from '@/lib/attestations/issue';

const CorrectBodySchema = z.object({
  part1Score: z.coerce.number().min(0).optional(),
  part2Score: z.coerce.number().min(0).nullable().optional(),
  part3Score: z.coerce.number().min(0).nullable().optional(),
  internshipScore: z.coerce.number().min(0).max(100).optional(),
  observations: z.string().optional(),
});

// POST /api/admin/submissions/[id]/correct - Hub unique de correction
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const parsed = CorrectBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiErrorImpl(
        'VALIDATION',
        'Données de correction invalides',
        parsed.error.flatten()
      );
    }

    const { part1Score, part2Score, part3Score, observations } = parsed.data;
    const internshipScore = round2(parsed.data.internshipScore ?? 0);

    // Récupérer la soumission avec l'examen
    const submission = await prisma.examSession.findUnique({
      where: { id },
      include: {
        exam: true,
        candidate: true,
      },
    });

    if (!submission) {
      throw new ApiErrorImpl('NOT_FOUND', 'Soumission non trouvée');
    }

    const { exam } = submission;

    // Barème serveur (jamais fourni par le client)
    const part1Enabled = exam.part1Enabled !== false;
    const part2Enabled = exam.part2Enabled !== false;
    const part3Enabled = exam.part3Enabled !== false;

    const mP1 = part1Enabled ? exam.part1Points ?? 0 : 0;
    const mP2 = part2Enabled ? exam.part2Points ?? 0 : 0;
    const mP3 = part3Enabled ? exam.part3Points ?? 0 : 0;
    const totalPoints = resolveExamMax(exam);

    // Validation des scores fournis (bornés par le barème, parts activées uniquement)
    if (part1Score !== undefined && part1Enabled && (part1Score < 0 || part1Score > mP1)) {
      throw new ApiErrorImpl('VALIDATION', `Le score Partie 1 doit être entre 0 et ${mP1}`);
    }
    if (part2Score != null && part2Enabled && (part2Score < 0 || part2Score > mP2)) {
      throw new ApiErrorImpl('VALIDATION', `Le score Partie 2 doit être entre 0 et ${mP2}`);
    }
    if (part3Score != null && part3Enabled && (part3Score < 0 || part3Score > mP3)) {
      throw new ApiErrorImpl('VALIDATION', `Le score Partie 3 doit être entre 0 et ${mP3}`);
    }

    // Parts désactivées ignorées ; sinon valeur fournie > valeur stockée > 0.
    // Sentinelle « non corrigé » : null (ou undefined) sur une partie activée
    // en PREMIÈRE correction → refus de passer GRADED (pas de fausse réussite).
    const isFirstGrading = submission.status !== 'GRADED';
    if (isFirstGrading) {
      if (part2Enabled && part2Score == null) {
        throw new ApiErrorImpl(
          'VALIDATION',
          'Partie 2 non corrigée : saisissez un score avant de valider'
        );
      }
      if (part3Enabled && part3Score == null) {
        throw new ApiErrorImpl(
          'VALIDATION',
          'Partie 3 non corrigée : saisissez un score avant de valider'
        );
      }
    }

    const scorePart1 = round2(
      part1Enabled ? part1Score ?? submission.scorePart1 ?? 0 : 0
    );
    const scorePart2 = round2(
      part2Enabled ? part2Score ?? submission.scorePart2 ?? 0 : 0
    );
    const scorePart3 = round2(
      part3Enabled ? part3Score ?? submission.scorePart3 ?? 0 : 0
    );

    // Échelle canonique : totalScore = somme brute, finalScore = pourcentage.
    // #124 — DÉCISION PRODUIT : internshipScore (note de stage) est un composant
    // SÉPARÉ qui alimente stageScore de l'attestation ; il n'entre PAS dans
    // finalScore (pourcentage de l'examen). Pas de moyenne pondérée composite.
    const totalScore = round2(scorePart1 + scorePart2 + scorePart3);
    const finalScore = Math.min(computeFinalScore(totalScore, totalPoints), 100);
    const passed = isPassed(finalScore, exam.passingScore);

    // Snapshot serveur du barème (client ne peut pas l'imposer).
    const bareme = {
      maxPart1: mP1,
      maxPart2: mP2,
      maxPart3: mP3,
      totalMax: totalPoints,
    };

    const currentAnswers: Record<string, unknown> =
      submission.answers &&
      typeof submission.answers === 'object' &&
      !Array.isArray(submission.answers)
        ? { ...(submission.answers as Record<string, unknown>) }
        : {};
    const updatedAnswers = { ...currentAnswers, _customBareme: bareme };

    const updatedSubmission = await prisma.examSession.update({
      where: { id },
      data: {
        status: 'GRADED',
        score: scorePart1, // legacy alias = Part 1 raw score
        scorePart1,
        scorePart2,
        scorePart3,
        totalScore,
        finalScore,
        internshipScore,
        gradedAt: new Date(),
        gradedBy: adminUser.id,
        answers: updatedAnswers as Prisma.InputJsonValue,
      },
      include: {
        candidate: true,
        exam: true,
      },
    });

    // Journal d'audit (avant / après)
    const isNewGrading = submission.status !== 'GRADED';
    await createAuditLog({
      userId: adminUser.id,
      action: isNewGrading ? 'GRADE_EXAM' : 'UPDATE_GRADE',
      resource: 'ExamSession',
      resourceId: id,
      oldValue: {
        score: submission.score,
        scorePart1: submission.scorePart1,
        scorePart2: submission.scorePart2,
        scorePart3: submission.scorePart3,
        totalScore: submission.totalScore,
        finalScore: submission.finalScore,
        internshipScore: submission.internshipScore,
        status: submission.status,
      },
      newValue: {
        score: scorePart1,
        scorePart1,
        scorePart2,
        scorePart3,
        totalScore,
        finalScore,
        internshipScore,
        status: 'GRADED',
        observations: observations ?? null,
      },
    });

    // Attestation (hub unique) : émise si réussi, mise à jour ou révoquée sinon.
    // Appelée pour tout examen OFFICIAL — issueExamAttestation gère la
    // re-correction (upsert score/mention) et la révocation (REJECTED si !passed).
    let attestationGenerated = false;
    let attestationCode: string | undefined;
    let attestationError: string | undefined;

    if (exam.type === 'OFFICIAL') {
      const attestation = await issueExamAttestation(id);
      attestationGenerated = attestation.created;
      attestationCode = attestation.code;
      attestationError = attestation.error;
    }

    // Notification du candidat (Email) — score en POURCENTAGE
    if (submission.candidate.email) {
      emailService.sendExamResults(
        submission.candidate.email,
        submission.candidate.name || '',
        exam.title,
        finalScore,
        passed,
        exam.type
      ).catch((err) => console.error('[EMAIL_NOTIF_ERROR]', err));
    }

    // Notification du candidat (In-App) — score en POURCENTAGE
    if (submission.userId) {
      const isMock = exam.type === 'MOCK';
      await createNotification({
        userId: submission.userId,
        type: 'EXAM_RESULT_PUBLISHED',
        title: passed
          ? isMock
            ? 'Entraînement corrigé ! 🎯'
            : 'Examen corrigé ! 🎉'
          : 'Correction disponible',
        message: passed
          ? isMock
            ? `Votre auto-évaluation "${exam.title}" a été corrigée. Score: ${totalScore}/${totalPoints} (${finalScore.toFixed(2)}%).`
            : `Félicitations ! Votre examen "${exam.title}" a été corrigé avec une moyenne globale de ${finalScore.toFixed(2)}/100.${attestationGenerated ? ' Votre attestation est prête.' : ''}`
          : `La correction de "${exam.title}" est terminée. Moyenne: ${finalScore.toFixed(2)}/100.`,
        link: isMock ? '/transcript' : passed ? '/attestations' : '/results',
      });

      // Déclenchement Pusher
      await pusherServer.trigger(`user-${submission.userId}`, 'notification', {
        title: passed ? 'Résultat disponible ! 🎉' : 'Correction terminée',
        message: `Votre copie pour "${exam.title}" a été corrigée.`,
        score: Math.round(finalScore),
      });
    }

    return NextResponse.json({
      message: 'Correction enregistrée avec succès',
      success: true,
      submission: {
        id: updatedSubmission.id,
        status: updatedSubmission.status,
        scorePart1,
        scorePart2,
        scorePart3,
        totalScore,
        maxScore: totalPoints,
        finalScore,
        internshipScore,
        gradedAt: updatedSubmission.gradedAt,
      },
      passed,
      attestationGenerated,
      attestationCode,
      attestationError,
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: '/api/admin/submissions/[id]/correct' });
  }
}
