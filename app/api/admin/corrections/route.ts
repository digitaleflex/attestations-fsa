import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const corrections = await prisma.correctionRequest.findMany({
      include: {
        user: { select: { name: true, email: true } },
        attestation: { select: { code: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(corrections);
  } catch (error) {
    console.error("[GET_CORRECTIONS_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    // 1. Récupérer la demande avec les relations nécessaires
    const correction = await prisma.correctionRequest.findUnique({
      where: { id },
      include: { 
          user: true,
          attestation: true
      }
    });

    if (!correction) {
      return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
    }

    // 2. Mettre à jour le statut de la demande
    const updatedRequest = await prisma.correctionRequest.update({
      where: { id },
      data: { status }
    });

    // 3. Si approuvé, mettre à jour le profil ET l'attestation
    if (status === "APPROVED") {
      const updateData: Record<string, any> = {};
      const attUpdateData: Record<string, any> = {};

      if (correction.field === "fullName") {
          updateData.name = correction.newValue;
          attUpdateData.fullName = correction.newValue;
      } else if (correction.field === "birthDate") {
          updateData.birthDate = new Date(correction.newValue);
          attUpdateData.birthDate = new Date(correction.newValue);
      } else if (correction.field === "birthPlace") {
          updateData.birthPlace = correction.newValue;
          attUpdateData.birthPlace = correction.newValue;
      }

      // Mise à jour de l'utilisateur
      await prisma.user.update({
        where: { id: correction.userId },
        data: updateData
      });

      // Mise à jour de l'attestation cible
      if (correction.attestationId) {
          await prisma.attestation.update({
              where: { id: correction.attestationId },
              data: attUpdateData
          });
      }
    }

    // 4. Notification pour l'utilisateur
    await createNotification({
        userId: correction.userId,
        type: status === "APPROVED" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED",
        title: status === "APPROVED" ? "Correction approuvée ! ✅" : "Correction refusée ❌",
        message: status === "APPROVED" 
            ? `Votre demande de correction pour "${correction.field}" a été validée. Vos documents ont été mis à jour.`
            : `Désolé, votre demande de correction pour "${correction.field}" n'a pas pu être acceptée.`,
        link: "/attestations",
        metadata: {
            requestId: correction.id,
            field: correction.field
        }
    });

    return NextResponse.json({ success: true, data: updatedRequest });
  } catch (error) {
    console.error("[PATCH_CORRECTION_ERROR]", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
