import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    // On autorise les messages même non connectés (depuis le site public),
    // mais si l'utilisateur est connecté on l'identifie.

    const body = await req.json();
    const { subject, message, email } = body;

    if (!subject || !message) {
      return NextResponse.json({ error: "Sujet et message requis" }, { status: 400 });
    }

    // On utilise la table Report pour stocker ces demandes (déjà existante dans le schéma)
    const report = await prisma.report.create({
      data: {
        motif: subject,
        message: message,
        email: user?.email || email || "anonyme@fsa.bj",
        status: "NOUVEAU",
      }
    });

    return NextResponse.json({
      success: true,
      message: "Votre message a été envoyé à l'assistance. Une réponse vous sera apportée très prochainement.",
      id: report.id
    });
  } catch {
    console.error("[SUPPORT_POST_ERROR]");
    return NextResponse.json({ error: "Erreur lors de l'envoi du message" }, { status: 500 });
  }
}
