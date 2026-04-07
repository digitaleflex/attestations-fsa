import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated, getCurrentUser } from '@/lib/auth';
import { customAlphabet } from 'nanoid';
import { emailService } from '@/lib/email';
import { createNotification } from '@/lib/notifications';
import type { ExamSessionStatus, AttestationStatus, AttestationType } from '@/lib/prisma-types';

const nanoid = customAlphabet('1234567890abcdef', 5);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const adminUser = await getCurrentUser();

    const { id } = await params; // Session ID
    const body = await request.json();
    const { scorePart2, scorePart3, observations } = body;

    // 1. Récupérer la session existante
    const session = await prisma.examSession.findUnique({
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

    if (!session) {
      return NextResponse.json(
        { error: "Soumission non trouvée" },
        { status: 404 }
      );
    }

    // 2. Calculer la note finale sur 20
    const totalRaw = session.scorePart1 + (scorePart2 || 0) + (scorePart3 || 0);
    const totalScore = totalRaw / 5; // Conversion sur 20

    // 3. Mettre à jour la session
    const updatedSession = await prisma.examSession.update({
      where: { id },
      data: {
        scorePart2: scorePart2 || 0,
        scorePart3: scorePart3 || 0,
        totalScore: Math.round(totalScore * 100) / 100,
        status: 'GRADED' as ExamSessionStatus,
        gradedAt: new Date(),
      }
    });

    // 4. Générer l'attestation si succès (>= 12/20)
    let attestationCreated = false;
    let attestationCode = null;

    if (totalScore >= 12 && session.exam.formationId && session.exam.type !== 'MOCK') {
      // Génération du code
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

      // ✅ FIX: Utiliser la date originale de soumission, pas la date actuelle
      // Si submittedAt est null, utiliser enrolledAt ou la date de notation comme dernier recours
      const startDate = session.candidate.enrolledAt || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = session.submittedAt || session.candidate.enrolledAt || now;

      // Création de l'attestation
      await prisma.attestation.create({
        data: {
          code: attestationCode,
          fullName: session.candidate.name || "Candidat Anonyme",
          birthDate: session.candidate.birthDate || new Date(1990, 0, 1),
          birthPlace: session.candidate.birthPlace || "Non spécifié",
          formationId: session.exam.formationId,
          startDate: startDate,
          endDate: endDate,
          location: "Abomey-Calavi",
          instructor: "Ferme St André",
          issuingCompany: "Ferme Agro-Piscicole Cité St André",
          type: 'CERTIFICATION' as AttestationType,
          status: 'VALIDATED' as AttestationStatus,
          certificationScore: totalScore * 5, // Score sur 100
          certificationObservations: observations || "Examen réussi.",
        }
      });
      attestationCreated = true;
    }

    // 5. Envoi de l'email de résultat au candidat
    await emailService.sendExamResults(
      session.candidate.email || "",
      session.candidate.name || "Candidat",
      session.exam.title,
      updatedSession.totalScore,
      totalScore >= 12
    );

    // 6. Créer une notification pour le candidat
    if (session.userId) {
      const passed = totalScore >= 12;
      await createNotification({
        userId: session.userId,
        type: 'EXAM_RESULT_PUBLISHED',
        title: passed ? 'Examen réussi ! 🎉' : 'Résultat d\'examen disponible',
        message: passed
          ? `Félicitations ! Vous avez réussi l'examen "${session.exam.title}" avec un score de ${updatedSession.totalScore}/20.${attestationCreated ? ` Une attestation a été créée (code: ${attestationCode}).` : ''}`
          : `Votre résultat pour l'examen "${session.exam.title}" est de ${updatedSession.totalScore}/20. Vous pouvez retenter l'examen.`,
        link: passed ? `/attestations` : `/results/${id}`,
      });
    }

    // ✅ FIX: Logger l'action de notation pour audit
    console.log(
      `[AUDIT] Note enregistrée par admin ${(adminUser as { email?: string })?.email || 'unknown'} | ` +
      `Session: ${id} | Score: ${updatedSession.totalScore}/20 | ` +
      `Attestation: ${attestationCreated ? 'CRÉÉE (' + attestationCode + ')' : 'NON CRÉÉE'}`
    );

    return NextResponse.json({
      message: "Note enregistrée avec succès",
      finalScore: updatedSession.totalScore,
      attestationCreated,
      attestationCode
    });

  } catch (error) {
    console.error("[GRADING ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de la notation" },
      { status: 500 }
    );
  }
}
