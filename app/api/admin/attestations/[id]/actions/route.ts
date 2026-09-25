import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';
import { mutationSealData } from '@/lib/attestations/proof';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminUser = await getAdminUser(request);

  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { action, reason } = await request.json();
    
    if (!reason || reason.trim().length < 5) {
        return NextResponse.json({ error: 'Un motif de minimum 5 caractères est obligatoire.' }, { status: 400 });
    }

    // Récupérer l'attestation actuelle avec les infos utilisateur
    const attestation = await prisma.attestation.findUnique({
      where: { id },
      include: {
        formation: true,
      }
    });

    if (!attestation) {
      return NextResponse.json({ error: 'Attestation non trouvée' }, { status: 404 });
    }

    const userId = attestation.userId;

    if (action === 'REVOKE') {
      // 🚩 RÉVOQUER : Simplement passer en rejeté
      const mutation = { status: 'REJECTED' };
      const updated = await prisma.attestation.update({
        where: { id },
        data: attestation.type === 'CERTIFICATION' && attestation.sessionId
          ? { ...mutation, ...mutationSealData(attestation, mutation) }
          : mutation
      });

      if (userId) {
        await createNotification({
          userId,
          type: 'ATTESTATION_REJECTED',
          title: 'Attestation Révoquée ❌',
          message: `Votre attestation pour "${attestation.formation?.name}" a été annulée par l'administration.`,
          link: '/results'
        });

        await createAuditLog({
          userId: adminUser?.id || "",
          action: 'ATTESTATION_REVOKED',
          resource: 'ATTESTATION',
          resourceId: id,
          newValue: { adminId: adminUser?.id, reason },
          ipAddress: request.headers.get("x-forwarded-for") || "unknown"
        });
      }

      return NextResponse.json({ message: 'Attestation révoquée', attestation: updated });
    }

    if (action === 'RETROGRADE') {
      // 🔄 RÉTROGRADER : Supprimer l'attestation et réinitialiser l'état d'examen

      // 1. Supprimer les sessions d'examen liées à cette formation pour cet utilisateur
      if (userId && attestation.formationId) {
        await prisma.examSession.deleteMany({
          where: {
            userId,
            exam: {
              formationId: attestation.formationId
            }
          }
        });
      }

      // 2. Remettre l'attestation en attente et réinitialiser les scores
      const mutation = {
        status: 'PENDING',
        certificationScore: 0,
        stageScore: 0,
        certificationHours: 0,
        stageHours: 0,
      };
      await prisma.attestation.update({
        where: { id },
        data: attestation.type === 'CERTIFICATION' && attestation.sessionId
          ? { ...mutation, ...mutationSealData(attestation, mutation) }
          : mutation
      });

      // 3. Logger et notifier
      if (userId) {
        await createNotification({
          userId,
          type: 'GENERAL',
          title: 'Examen à repasser 🔄',
          message: `Votre évaluation pour "${attestation.formation?.name}" a été réinitialisée. Vous devez repasser l'examen. Motif : ${reason}`,
          link: '/exams'
        });

        await createAuditLog({
          userId: adminUser?.id || "",
          action: 'USER_RETROGRADED',
          resource: 'USER',
          resourceId: userId,
          oldValue: { attestationCode: attestation.code },
          newValue: { adminId: adminUser?.id, action: 'RESET_EXAM_STATUS', reason },
          ipAddress: request.headers.get("x-forwarded-for") || "unknown"
        });
      }

      return NextResponse.json({ message: 'Candidat rétrogradé avec succès' });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });

  } catch (error: any) {
    console.error("Erreur action admin:", error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
