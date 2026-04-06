import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated, getCurrentUser } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminUser = await getCurrentUser(request);

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { action } = await request.json();
    
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
      const updated = await prisma.attestation.update({
        where: { id },
        data: { status: 'REJECTED' }
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
          userId,
          action: 'ATTESTATION_REVOKED',
          resource: 'ATTESTATION',
          resourceId: id,
          newValue: { adminId: adminUser?.id, reason: 'Administrative Revocation' },
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
            formationId: attestation.formationId
          }
        });
      }

      // 2. Supprimer l'attestation elle-même
      await prisma.attestation.delete({
        where: { id }
      });

      // 3. Logger et notifier
      if (userId) {
        await createNotification({
          userId,
          type: 'EXAM_RESET',
          title: 'Examen à repasser 🔄',
          message: `Votre évaluation pour "${attestation.formation?.name}" a été réinitialisée. Vous devez repasser l'examen.`,
          link: '/exam'
        });

        await createAuditLog({
          userId,
          action: 'USER_RETROGRADED',
          resource: 'USER',
          resourceId: userId,
          oldValue: { attestationCode: attestation.code },
          newValue: { adminId: adminUser?.id, action: 'RESET_EXAM_STATUS' },
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
