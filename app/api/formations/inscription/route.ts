import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailService } from "@/lib/email";

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

    // Notification admin : ne doit jamais faire échouer l'inscription.
    try {
      const settings = await prisma.settings.findFirst();
      const adminEmail =
        settings?.supportEmail ||
        process.env.SUPPORT_EMAIL ||
        "contact@fermestandre.com";

      const body = [
        `Nom : ${nom}`,
        `Email : ${email}`,
        `Téléphone : ${telephone}`,
        `Formation : ${formation.name}`,
        `Message : ${message || "—"}`,
        `Date : ${new Date().toLocaleString("fr-FR")}`,
      ].join("\n");

      await emailService.sendGeneralNotification(
        adminEmail,
        "Administration FSA",
        "Nouvelle inscription à une formation",
        body
      );
    } catch (emailError) {
      console.error("Erreur envoi notification email inscription formation:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur inscription formation:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'inscription" },
      { status: 500 }
    );
  }
}
