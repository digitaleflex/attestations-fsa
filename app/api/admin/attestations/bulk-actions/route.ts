import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAdminUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // 🛡️ Rate limiting - Protection contre abus bulk operations
  const rateLimit = await applyRateLimit(request, 'adminBulk');
  if (!rateLimit.allowed && rateLimit.response) {
    return rateLimit.response;
  }

  const { ids, action } = await request.json();

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Aucun ID sélectionné" }, { status: 400 });
  }

  try {
    const results = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const processed = [];
      for (const id of ids) {
        const attestation = await tx.attestation.findUnique({
          where: { id },
          include: { formation: true }
        });

        if (!attestation) continue;

        if (action === 'REVOKE') {
          const updated = await tx.attestation.update({
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
          
          processed.push(updated);
        } else if (action === 'RETROGRADE') {
          // Supprimer sessions d'examen
          if (attestation.userId && attestation.formationId) {
            await tx.examSession.deleteMany({
              where: {
                userId: attestation.userId,
                exam: { formationId: attestation.formationId }
              }
            });
          }

          const updated = await tx.attestation.update({
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
              link: '/exams'
            });
          }
          
          processed.push(updated);
        }
      }
      return processed;
    });

    // 🛡️ Audit Log
    await createAuditLog({
      userId: adminUser?.id || "",
      action: 'BULK_ACTION',
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

  } catch (error: unknown) {
    console.error("Bulk Action Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur lors de l'action groupée" }, { status: 500 });
  }
}
