import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Helper pour vérifier l'authentification admin
async function isAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  if (!session || !session.value) return null;
  if (role?.value !== 'ADMIN') return null;
  
  return session.value;
}

// POST /api/admin/submissions/[id]/correct - Corriger une soumission
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await isAuthenticatedAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { part2Score, part3Score, part2Feedback, part3Feedback } = body;

    // Validation
    if (part2Score === undefined || part3Score === undefined) {
      return NextResponse.json({ 
        message: 'Les scores Partie 2 et Partie 3 sont requis' 
      }, { status: 400 });
    }

    if (part2Score < 0 || part2Score > 40) {
      return NextResponse.json({ 
        message: 'Le score Partie 2 doit être entre 0 et 40' 
      }, { status: 400 });
    }

    if (part3Score < 0 || part3Score > 40) {
      return NextResponse.json({ 
        message: 'Le score Partie 3 doit être entre 0 et 40' 
      }, { status: 400 });
    }

    // Récupérer la soumission
    const submission = await prisma.examSession.findUnique({
      where: { id },
      include: {
        exam: true,
        candidate: true,
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Soumission non trouvée' }, { status: 404 });
    }

    // Calculer le score total
    const qcmScore = submission.scorePart1 || 0;
    const totalScore = qcmScore + part2Score + part3Score;
    const percentage = Math.round((totalScore / 100) * 100);
    const isPassing = percentage >= 60;

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
        gradedBy: adminId
      },
      include: {
        candidate: true,
        exam: true,
      }
    });

    // Si réussi (≥ 60%), générer automatiquement l'attestation
    if (isPassing) {
      try {
        // Générer un code unique (utilisant customAlphabet correct)
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

        console.log(`✅ Attestation générée automatiquement: ${code}`);
      } catch (error: any) {
        console.error('Erreur génération attestation:', error);
        // On ne bloque pas la correction si la génération d'attestation échoue
      }
    }

    return NextResponse.json({
      message: 'Correction enregistrée avec succès',
      submission: updatedSubmission,
      attestationGenerated: isPassing,
    });

  } catch (error: any) {
    console.error('Erreur correction admin:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la correction' 
    }, { status: 500 });
  }
}
