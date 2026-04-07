import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated, getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const adminUser = await getCurrentUser(request);
  const { ids, action } = await request.json();

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Aucun ID sélectionné" }, { status: 400 });
  }

  try {
    const results = [];

    for (const id of ids) {
      const attestation = await prisma.attestation.findUnique({
        where: { id },
        include: { formation: true }
      });

      if (!attestation) continue;

      if (action === 'REVOKE') {
        const updated = await prisma.attestation.update({
          where: { id },
          data: { status: 'REJECTED' }
        });
        
        if (attestation.userId) {
          await createNotification({
            userId: attestation.userId,
            type: 'ATTESTATION_REJECTED',
            title: 'Attestation Révoquée ❌',
            message: `Votre attestation pour "${attestation.formation?.name}" a été annulée par l'administration.`,
            link: '/results'
          });
        }
        
        results.push(updated);
      } else if (action === 'RETROGRADE') {
        // Supprimer sessions d'examen
        if (attestation.userId && attestation.formationId) {
          await prisma.examSession.deleteMany({
            where: {
              userId: attestation.userId,
              exam: { formationId: attestation.formationId }
            }
          });
        }

        const updated = await prisma.attestation.update({
          where: { id },
          data: { 
            status: 'PENDING',
            certificationScore: 0,
            stageScore: 0,
            certificationHours: 0,
            stageHours: 0
          }
        });

        if (attestation.userId) {
          await createNotification({
            userId: attestation.userId,
            type: 'GENERAL',
            title: 'Examen à repasser 🔄',
            message: `Votre évaluation pour "${attestation.formation?.name}" a été réinitialisée.`,
            link: '/exam'
          });
        }
        
        results.push(updated);
      }
    }

    // 🛡️ Audit Log
    await createAuditLog({
      userId: adminUser?.id || "",
      action: `BULK_${action}`,
      resource: 'ATTESTATION',
      resourceId: ids.join(','),
      newValue: { count: ids.length, action, ids },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown"
    });

    return NextResponse.json({ 
      success: true, 
      count: results.length,
      message: `${results.length} éléments traités.`
    });

  } catch (error: any) {
    console.error("Bulk Action Error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de l'action groupée" }, { status: 500 });
  }
}
