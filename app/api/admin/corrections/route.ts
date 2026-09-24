import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAdminUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Fusion #98/#111: les corrections sont maintenant dans Reclamation type CORRECTION
    const corrections = await prisma.reclamation.findMany({
      where: { type: "CORRECTION" },
      include: {
        user: { select: { name: true, email: true } },
        attestation: { select: { code: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    // Shape compatible avec l'ancienne API (correctionRequest)
    return NextResponse.json(corrections.map(c => ({
      id: c.id,
      status: c.status,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      reason: c.reason,
      user: c.user ? { name: c.user.name, email: c.user.email } : null,
      attestation: c.attestation ? { code: c.attestation.code } : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })));
  } catch (error) {
    console.error("[GET_CORRECTIONS_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    // 1. Récupérer la réclamation de type CORRECTION avec les relations nécessaires
    const reclamation = await prisma.reclamation.findUnique({
      where: { id },
      include: { 
          user: true,
          attestation: true
      }
    });

    if (!reclamation || reclamation.type !== "CORRECTION") {
      return NextResponse.json({ error: "Demande de correction non trouvée" }, { status: 404 });
    }

    // 2. Mettre à jour le statut de la réclamation
    const updatedReclamation = await prisma.reclamation.update({
      where: { id },
      data: { status }
    });

    // 3. Si approuvé, mettre à jour le profil ET l'attestation
    if (status === "APPROVED") {
      // 🛡️ TRANSACTION POUR GARANTIR L'INTÉGRITÉ
      await (prisma as any).$transaction(async (tx: any) => {
        const updateData: { name?: string; birthDate?: Date; birthPlace?: string } = {};
        const attUpdateData: { fullName?: string; birthDate?: Date; birthPlace?: string } = {};

        const newValue = reclamation.newValue ?? "";
        const oldValue = reclamation.oldValue ?? "";

        if (reclamation.field === "fullName") {
          updateData.name = newValue;
          attUpdateData.fullName = newValue;
        } else if (reclamation.field === "birthDate") {
          const birthDate = new Date(newValue);
          updateData.birthDate = birthDate;
          attUpdateData.birthDate = birthDate;
        } else if (reclamation.field === "birthPlace") {
          updateData.birthPlace = newValue;
          attUpdateData.birthPlace = newValue;
        }

        // Mise à jour de l'utilisateur
        await tx.user.update({
          where: { id: reclamation.userId },
          data: updateData
        });

        // Mise à jour de l'attestation cible
        if (reclamation.attestationId) {
          await tx.attestation.update({
            where: { id: reclamation.attestationId },
            data: attUpdateData
          });
        }

        // 🛡️ Audit Log inside transaction
        await createAuditLog({
          userId: adminUser.id,
          action: 'CORRECTION_APPROVED',
          resource: 'RECLAMATION', // was CORRECTION_REQUEST
          resourceId: id,
          newValue: { 
            field: reclamation.field, 
            oldValue: reclamation.oldValue,
            newValue: reclamation.newValue,
            userId: reclamation.userId 
          },
          ipAddress: request.headers.get("x-forwarded-for") || "unknown"
        }, tx);
      });
    }

    // 4. Notification pour l'utilisateur
    await createNotification({
        userId: reclamation.userId,
        type: status === "APPROVED" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED",
        title: status === "APPROVED" ? "Correction approuvée ! ✅" : "Correction refusée ❌",
        message: status === "APPROVED" 
            ? `Votre demande de correction pour "${reclamation.field}" a été validée. Vos documents ont été mis à jour.`
            : `Désolé, votre demande de correction pour "${reclamation.field}" n'a pas pu être acceptée.`,
        link: "/attestations",
        metadata: {
            requestId: reclamation.id,
            field: reclamation.field
        }
    });

    // 🛡️ Audit Log for rejection
    if (status === "REJECTED") {
        await createAuditLog({
            userId: adminUser.id,
            action: 'CORRECTION_REJECTED',
            resource: 'RECLAMATION', // was CORRECTION_REQUEST
            resourceId: id,
            newValue: { 
                field: reclamation.field,
                userId: reclamation.userId 
            },
            ipAddress: request.headers.get("x-forwarded-for") || "unknown"
        });
    }

    // Return shape compatible with old API
    return NextResponse.json({ 
      success: true, 
      data: {
        id: updatedReclamation.id,
        status: updatedReclamation.status,
        field: reclamation.field,
        oldValue: reclamation.oldValue,
        newValue: reclamation.newValue,
        reason: reclamation.reason,
        user: reclamation.user ? { name: reclamation.user.name, email: reclamation.user.email } : null,
        attestation: reclamation.attestation ? { code: reclamation.attestation.code } : null,
      }
    });
  } catch (error) {
    console.error("[PATCH_CORRECTION_ERROR]", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}