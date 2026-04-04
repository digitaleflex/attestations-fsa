import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated, getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiErrorImpl } from '@/lib/error-handler';
import { emailService } from '@/lib/email';

// POST /api/admin/submissions/[id]/correct - Corriger une soumission
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdminAuthenticated()) {
      return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { part2Score, part3Score } = body;

    const admin = await getCurrentUser();

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

    // Validation
    if (part2Score === undefined || part3Score === undefined) {
      throw new ApiErrorImpl('VALIDATION', 'Les scores Partie 2 et Partie 3 sont requis');
    }

    if (part2Score < 0 || part2Score > (exam.part2Points || 40)) {
      throw new ApiErrorImpl('VALIDATION', `Le score Partie 2 doit être entre 0 et ${exam.part2Points || 40}`);
    }

    if (part3Score < 0 || part3Score > (exam.part3Points || 40)) {
      throw new ApiErrorImpl('VALIDATION', `Le score Partie 3 doit être entre 0 et ${exam.part3Points || 40}`);
    }

    // Calculer le score total
    const qcmScore = submission.scorePart1 || 0;
    const totalScore = qcmScore + part2Score + part3Score;
    const maxPoints = exam.totalPoints || 100;
    const percentage = Math.round((totalScore / maxPoints) * 100);
    const passingThreshold = exam.passingScore || 60;
    const isPassing = percentage >= passingThreshold;

    // Mettre à jour la soumission
    const updatedSubmission = await prisma.examSession.update({
      where: { id },
      data: {
        status: 'GRADED',
        score: totalScore,
        totalScore: totalScore,
        gradedAt: new Date(),
        scorePart2: part2Score,
        scorePart3: part3Score,
        gradedBy: admin?.id
      },
      include: {
        candidate: true,
        exam: true,
      }
    });

    // Si réussi (≥ 60%), générer automatiquement l'attestation
    if (isPassing) {
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

        // Créer l'attestation
        await prisma.attestation.create({
          data: {
            code,
            fullName: submission.candidate.name || '',
            birthDate: submission.candidate.birthDate || new Date(),
            birthPlace: submission.candidate.birthPlace || '',
            formationId: submission.exam.formationId || '',
            type: 'CERTIFICATION',
            status: 'VALIDATED',
            startDate: submission.startedAt,
            endDate: submission.submittedAt || new Date(),
            location: 'En ligne',
            instructor: 'Système automatique',
            issuingCompany: 'Ferme St André',
            certificationScore: percentage,
            certificationMention: percentage >= 90 ? 'EXCELLENCE' :
                                 percentage >= 80 ? 'TRES_BIEN' :
                                 percentage >= 70 ? 'BIEN' :
                                 percentage >= 60 ? 'ASSEZ_BIEN' : 'PASSABLE',
          }
        });

      } catch (error: any) {
        console.error('Erreur génération attestation:', error);
      }
    }

    // Notification du candidat (Optionnel, n'échoue pas la requête si l'email échoue)
    if (submission.candidate.email) {
       emailService.sendExamResults(
        submission.candidate.email,
        submission.candidate.name || "",
        submission.exam.title,
        totalScore,
        isPassing
      ).catch(err => console.error("[EMAIL_NOTIF_ERROR]", err));
    }

    return NextResponse.json({
      message: 'Correction enregistrée avec succès',
      success: true,
      attestationGenerated: isPassing,
    });

  } catch (error: any) {
    return handleApiError(error, { route: '/api/admin/submissions/[id]/correct' });
  }
}
