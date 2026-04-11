import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { handleApiError, ApiErrorImpl } from '@/lib/error-handler';
import { emailService } from '@/lib/email';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';
import { pusherServer } from '@/lib/pusher';

// POST /api/admin/submissions/[id]/correct - Corriger une soumission
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
    const { 
      part1Score, 
      part2Score, 
      part3Score, 
      internshipScore = 0,
      maxPart1,
      maxPart2,
      maxPart3
    } = body;

    // Récupérer la soumission avec l'examen
    const submission = await prisma.examSession.findUnique({
      where: { id },
      include: {
        exam: true,
        candidate: true,
      }
    });

    if (!submission) {
      throw new ApiErrorImpl('NOT_FOUND', 'Soumission non trouvée');
    }

    const { exam } = submission;

    // Utiliser les points max fournis ou ceux de l'examen par défaut
    const mP1 = maxPart1 !== undefined ? maxPart1 : (exam.part1Points || 20);
    const mP2 = maxPart2 !== undefined ? maxPart2 : (exam.part2Points || 40);
    const mP3 = maxPart3 !== undefined ? maxPart3 : (exam.part3Points || 40);
    const totalMaxPossible = mP1 + mP2 + mP3;

    // Validation des scores
    if (part2Score === undefined || part3Score === undefined) {
      throw new ApiErrorImpl('VALIDATION', 'Les scores Partie 2 et Partie 3 sont requis');
    }

    if (part1Score !== undefined && (part1Score < 0 || part1Score > mP1)) {
      throw new ApiErrorImpl('VALIDATION', `Le score Partie 1 doit être entre 0 et ${mP1}`);
    }

    if (part2Score < 0 || part2Score > mP2) {
      throw new ApiErrorImpl('VALIDATION', `Le score Partie 2 doit être entre 0 et ${mP2}`);
    }

    if (part3Score < 0 || part3Score > mP3) {
      throw new ApiErrorImpl('VALIDATION', `Le score Partie 3 doit être entre 0 et ${mP3}`);
    }

    // Calculer le score total de l'examen
    const qcmScore = part1Score !== undefined ? part1Score : (submission.scorePart1 || 0);
    const examTotalPoints = qcmScore + part2Score + part3Score;
    
    // Conversion sur 100 pour la logique de réussite basée sur le barème AJUSTÉ
    const examPercentage = (examTotalPoints / totalMaxPossible) * 100;
    
    // Calcul de la note finale combinée (Évaluation Global = [Note Exam % + Note Stage %] / 2)
    // On suppose ici que internshipScore est fourni sur 100 (ou on le normalise s'il est sur 20)
    // Si l'utilisateur saisit sur 20, on multiplie par 5.
    const normalizedInternshipScore = internshipScore <= 20 ? internshipScore * 5 : internshipScore;
    
    // Pour un examen blanc, la note finale est uniquement la note de l'examen.
    // Pour un examen officiel, c'est la moyenne (Exam + Stage) / 2.
    const finalPercentage = submission.exam.type === 'MOCK' 
      ? examPercentage 
      : (examPercentage + normalizedInternshipScore) / 2;
    
    const passingThreshold = exam.passingScore || 65;
    const isPassing = finalPercentage >= passingThreshold;

    // Mettre à jour la soumission
    // On stocke le barème personnalisé dans le champ answers pour qu'il soit récupérable par le candidat
    const currentAnswers = (submission.answers as any) || {};
    const updatedAnswers = {
      ...currentAnswers,
      _customBareme: {
        maxPart1: mP1,
        maxPart2: mP2,
        maxPart3: mP3,
        totalMax: totalMaxPossible
      }
    };

    const updatedSubmission = await prisma.examSession.update({
      where: { id },
      data: {
        status: 'GRADED',
        score: examTotalPoints,
        totalScore: examTotalPoints,
        internshipScore: normalizedInternshipScore,
        finalScore: finalPercentage,
        gradedAt: new Date(),
        scorePart1: qcmScore,
        scorePart2: part2Score,
        scorePart3: part3Score,
        gradedBy: adminUser?.id,
        answers: updatedAnswers
      },
      include: {
        candidate: true,
        exam: true,
      }
    });
    
    // Journal d'audit
    const isNewGrading = submission.status !== 'GRADED';
    await createAuditLog({
      userId: adminUser.id,
      action: isNewGrading ? "GRADE_EXAM" : "UPDATE_GRADE",
      resource: "ExamSession",
      resourceId: id,
      oldValue: isNewGrading ? null : {
        score: submission.score,
        internshipScore: submission.internshipScore,
        finalScore: submission.finalScore,
        status: submission.status
      },
      newValue: {
        score: updatedSubmission.score,
        internshipScore: updatedSubmission.internshipScore,
        finalScore: updatedSubmission.finalScore,
        status: updatedSubmission.status
      }
    });

    // Si réussi (≥ 65%), générer automatiquement l'attestation si ce n'est pas un examen blanc
    let attestationError = null;
    if (isPassing && submission.exam.type !== 'MOCK') {
      try {
        const { customAlphabet } = await import('nanoid');
        const customNanoid = customAlphabet('1234567890abcdef', 5);
        
        const now = new Date();
        const year = now.getFullYear();
        const month = `M${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const count = await prisma.attestation.count({
          where: {
            issuedAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
            }
          }
        });
        
        const seq = String(count + 1).padStart(5, '0');
        const hash = customNanoid();
        const code = `FSA-${year}-${month}-${seq}-${hash}`;

        // ✅ SECURITÉ : Vérifier si formationId est valide
        let formationId = submission.exam.formationId;
        if (!formationId) {
            // Tentative de récupération d'une formation par défaut si aucune n'est liée à l'examen
            const defaultFormation = await prisma.formation.findFirst();
            formationId = defaultFormation?.id || "";
            console.warn(`[ATTESTATION] Exam ${exam.id} has no formationId. Using default: ${formationId}`);
        }

        if (!formationId) {
            throw new Error("Impossible de générer l'attestation : Aucune formation n'est définie dans le système.");
        }

        // Créer l'attestation
        await prisma.attestation.create({
          data: {
            code,
            fullName: submission.candidate.name || 'Candidat Anonyme',
            birthDate: submission.candidate.birthDate || new Date(),
            birthPlace: submission.candidate.birthPlace || 'Non renseigné',
            formationId: formationId,
            type: 'CERTIFICATION',
            status: 'VALIDATED',
            startDate: submission.startedAt,
            endDate: submission.submittedAt || new Date(),
            location: 'En ligne (Plateforme FSA)',
            userId: submission.userId,
            instructor: 'Direction Technique FSA',
            issuingCompany: 'FSA - Ferme Agro-Piscicole Cité St André',
            certificationScore: finalPercentage,
            stageScore: normalizedInternshipScore,
            certificationMention: finalPercentage >= 90 ? 'EXCELLENCE' :
                                 finalPercentage >= 80 ? 'TRES_BIEN' :
                                 finalPercentage >= 70 ? 'BIEN' :
                                 finalPercentage >= 65 ? 'ASSEZ_BIEN' : 'PASSABLE',
          }
        });

      } catch (error: any) {
        console.error('Erreur génération attestation:', error);
        attestationError = error.message;
      }
    }

    // Notification du candidat (Email)
    if (submission.candidate.email) {
       emailService.sendExamResults(
        submission.candidate.email,
        submission.candidate.name || "",
        submission.exam.title,
        finalPercentage,
        isPassing,
        submission.exam.type as any
      ).catch(err => console.error("[EMAIL_NOTIF_ERROR]", err));
    }

    // Notification du candidat (In-App)
    if (submission.userId) {
        const isMock = submission.exam.type === 'MOCK';
        await createNotification({
            userId: submission.userId,
            type: 'EXAM_RESULT_PUBLISHED',
            title: isPassing 
              ? (isMock ? 'Entraînement corrigé ! 🎯' : 'Examen corrigé ! 🎉')
              : 'Correction disponible',
            message: isPassing
              ? (isMock 
                  ? `Votre auto-évaluation "${submission.exam.title}" a été corrigée. Score: ${examTotalPoints}/${totalMaxPossible}.`
                  : `Félicitations ! Votre examen "${submission.exam.title}" a été corrigé avec une moyenne globale de ${finalPercentage.toFixed(2)}/100.${isPassing && submission.exam.type !== 'MOCK' ? ' Votre attestation est prête.' : ''}`)
              : `La correction de "${submission.exam.title}" est terminée. Moyenne: ${finalPercentage.toFixed(2)}/100.`,
            link: isMock ? '/transcript' : (isPassing ? '/attestations' : '/results'),
        });

        // Déclenchement Pusher
        await pusherServer.trigger(`user-${submission.userId}`, "notification", {
            title: isPassing ? "Résultat disponible ! 🎉" : "Correction terminée",
            message: `Votre copie pour "${submission.exam.title}" a été corrigée.`,
            score: Math.round(finalPercentage)
        });
    }

    return NextResponse.json({
      message: 'Correction enregistrée avec succès',
      success: true,
      attestationGenerated: isPassing && submission.exam.type !== 'MOCK' && !attestationError,
      attestationError: attestationError
    });

  } catch (error: any) {
    return handleApiError(error, { route: '/api/admin/submissions/[id]/correct' });
  }
}
