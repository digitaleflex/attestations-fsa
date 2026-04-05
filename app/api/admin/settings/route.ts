import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated, getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    // On récupère les réglages (il n'y en a qu'un seul en général)
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      // Si pas de réglages, on en crée un par défaut
      settings = await prisma.settings.create({
        data: {
          institutionName: "Ferme Agro-Piscicole Cité St André",
          instructorName: "Directeur Technique",
          instructorTitle: "Responsable des Formations",
          supportEmail: "contact@fsa.bj",
          targetInscriptions: 500,
          targetAttestations: 300,
          targetValidations: 450
        }
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("[SETTINGS_GET_ERROR]", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminUser = await getCurrentUser(request);
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
        return NextResponse.json({ message: "ID requis pour la mise à jour" }, { status: 400 });
    }

    // Désinfecter les données numériques
    const updateData = { ...data };
    if (updateData.targetInscriptions) updateData.targetInscriptions = parseInt(updateData.targetInscriptions);
    if (updateData.targetAttestations) updateData.targetAttestations = parseInt(updateData.targetAttestations);
    if (updateData.targetValidations) updateData.targetValidations = parseInt(updateData.targetValidations);

    const updated = await prisma.settings.update({
      where: { id },
      data: updateData
    });

    // Audit log
    if (adminUser) {
      await createAuditLog({
        userId: adminUser.id, // Comme c'est une action globale, on lie à l'admin (qui est aussi un User dans ce système pour simplifier)
        action: 'SETTINGS_UPDATED',
        resource: 'SYSTEM_SETTINGS',
        resourceId: id,
        newValue: {
          changes: data,
          adminName: adminUser.name
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown"
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[SETTINGS_PATCH_ERROR]", error);
    return NextResponse.json({ message: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
