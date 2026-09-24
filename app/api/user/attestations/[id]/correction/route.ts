import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { field, newValue, reason } = body;

    if (!field || !newValue) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    // Vérifier que l'attestation appartient bien à l'utilisateur
    const attestation = await prisma.attestation.findUnique({
      where: { id },
      select: { id: true, userId: true, fullName: true, birthDate: true, birthPlace: true }
    });

    if (!attestation || attestation.userId !== user.id) {
      return NextResponse.json({ error: "Attestation non trouvée" }, { status: 404 });
    }

    // Récupérer l'ancienne valeur dynamiquement
    let oldValue = "";
    if (field === "fullName") oldValue = attestation.fullName;
    else if (field === "birthDate") oldValue = attestation.birthDate.toISOString().split('T')[0];
    else if (field === "birthPlace") oldValue = attestation.birthPlace;

    // Créer la demande de correction dans le canal unifié Reclamation (type CORRECTION)
    const reclamation = await prisma.reclamation.create({
      data: {
        userId: user.id,
        type: "CORRECTION",
        subject: `Correction de ${field}`,
        message: reason ?? `Demande de correction du champ ${field}`,
        field,
        oldValue: oldValue || null,
        newValue,
        reason,
        attestationId: id,
        status: "PENDING",
      }
    });

    // TODO: Envoyer une notification aux admins ?
    
    return NextResponse.json({
      message: "Demande de correction envoyée avec succès",
      id: reclamation.id
    });

  } catch (error) {
    console.error("[CORRECTION_REQUEST_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}