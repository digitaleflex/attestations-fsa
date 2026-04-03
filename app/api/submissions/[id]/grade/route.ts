import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { customAlphabet } from 'nanoid';
import { emailService } from '@/lib/email';

const nanoid = customAlphabet('1234567890abcdef', 5);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const { id } = params; // Submission ID
    const body = await request.json();
    const { scorePart2, scorePart3, observations } = body;

    // 1. Récupérer la soumission existante
    const submission = await prisma.examSession.findUnique({
      where: { id },
      include: {
        candidate: true,
        exam: {
          include: {
            formation: true
          }
        }
      }
    });

    if (!submission) {
      return NextResponse.json({ message: "Soumission non trouvée" }, { status: 404 });
    }

    // 2. Calculer la note finale sur 20
    const totalRaw = submission.scorePart1 + (scorePart2 || 0) + (scorePart3 || 0);
    const totalScore = totalRaw / 5; // Conversion sur 20

    // 3. Mettre à jour la soumission
    const updatedSubmission = await prisma.examSession.update({
      where: { id },
      data: {
        scorePart2: scorePart2 || 0,
        scorePart3: scorePart3 || 0,
        totalScore: Math.round(totalScore * 100) / 100,
        status: "GRADED",
        gradedAt: new Date(),
      }
    });

    // 4. Générer l'attestation si succès (>= 12/20)
    let attestationCreated = false;
    let attestationCode = null;

    if (totalScore >= 12 && submission.exam.formationId) {
      // Génération du code (Copie de la logique officielle)
      const now = new Date();
      const year = now.getFullYear();
      const month = `M${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      const startOfNextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

      const count = await prisma.attestation.count({
        where: {
          issuedAt: {
            gte: startOfMonth,
            lt: startOfNextMonth
          }
        }
      });

      const seq = String(count + 1).padStart(5, '0');
      const hash = nanoid();
      attestationCode = `FSA-${year}-${month}-${seq}-${hash}`;

      // Calcul des dates réelles (Début = Inscription, Fin = Soumission de l'examen)
      const startDate = submission.candidate.enrolledAt || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = submission.submittedAt || now;

      // Création de l'attestation
      await prisma.attestation.create({
        data: {
          code: attestationCode,
          fullName: submission.candidate.name || "Candidat Anonyme",
          birthDate: submission.candidate.birthDate || new Date(1990, 0, 1),
          birthPlace: submission.candidate.birthPlace || "Non spécifié",
          formationId: submission.exam.formationId,
          startDate: startDate,
          endDate: endDate,
          location: "Abomey-Calavi",
          instructor: "Ferme St André",
          issuingCompany: "Ferme Agro-Piscicole Cité St André",
          type: "CERTIFICATION",
          status: "VALIDATED",
          certificationScore: totalScore * 5, // Score sur 100
          certificationObservations: observations || "Examen réussi.",
        }
      });
      attestationCreated = true;
    }

    // 5. Envoi de l'email de résultat au candidat
    await emailService.sendExamResults(
      submission.candidate.email || "",
      submission.candidate.name || "Candidat",
      submission.exam.title,
      updatedSubmission.totalScore,
      totalScore >= 12
    );

    return NextResponse.json({
      message: "Note enregistrée avec succès",
      finalScore: updatedSubmission.totalScore,
      attestationCreated,
      attestationCode
    });

  } catch (error) {
    console.error("[GRADING ERROR]", error);
    return NextResponse.json({ message: "Erreur lors de la notation" }, { status: 500 });
  }
}
