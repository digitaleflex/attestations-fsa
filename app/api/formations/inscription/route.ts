import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nom, email, telephone, formationId, message } = body;

    if (!nom || !email || !telephone || !formationId) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants" },
        { status: 400 }
      );
    }

    const formation = await prisma.formation.findUnique({
      where: { id: formationId },
      select: { name: true },
    });

    if (!formation) {
      return NextResponse.json(
        { error: "Formation introuvable" },
        { status: 404 }
      );
    }

    await prisma.contact.create({
      data: {
        name: nom,
        email,
        phone: telephone,
        subject: `Inscription formation: ${formation.name}`,
        message: message || `Inscription à la formation: ${formation.name} (ID: ${formationId})`,
        type: "FORMATION_INSCRIPTION",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur inscription formation:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'inscription" },
      { status: 500 }
    );
  }
}
