import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { applyRateLimit } from "@/lib/rate-limit";
import { emailService } from "@/lib/email";
import { sanitizeInput } from "@/lib/sanitization";

// Même garde-fou que `/api/public/contact` : sans validation serveur ni
// rate limit, chaque appel spam = 1 ligne `Contact` + 1 e-mail admin.
const InscriptionSchema = z.object({
  nom: z.string().trim().min(2, "Nom trop court").max(120),
  email: z.string().trim().email("Email invalide").max(254),
  telephone: z.string().trim().min(6, "Numéro de téléphone invalide").max(40),
  formationId: z.string().min(1, "Formation requise"),
  message: z.string().trim().max(5000).optional(),
});

export async function POST(req: Request) {
  try {
    // Rate limit - 5 demandes par heure par IP (seau `contact` partagé : même
    // table, même profil d'abus).
    const rateLimit = await applyRateLimit(req, "contact");
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const body = await req.json();
    const parse = InscriptionSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parse.error.errors },
        { status: 400 }
      );
    }

    const { nom, email, telephone, formationId, message } = parse.data;

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
        name: sanitizeInput(nom),
        email: sanitizeInput(email),
        phone: sanitizeInput(telephone),
        subject: `Inscription formation: ${formation.name}`,
        message: message ? sanitizeInput(message) : `Inscription à la formation: ${formation.name} (ID: ${formationId})`,
        category: "FORMATION_INSCRIPTION",
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
