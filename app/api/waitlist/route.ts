import { NextResponse } from "next/server";
import { z } from "zod";
import { emailService } from "@/lib/email";
import { applyRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const WaitlistSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  name: z.string().optional(),
  message: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // Rate Limiting (optionnel mais recommandé)
    const rateLimit = await applyRateLimit(req, 'waitlist');
    if (!rateLimit.allowed && rateLimit.response) return rateLimit.response;

    const body = await req.json();
    const result = WaitlistSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const { email, name, message } = result.data;

    // ✅ SAVE TO DATABASE BEFORE SENDING EMAILS
    // This ensures we never lose a signup even if email fails
    let existingWaitlist = await prisma.waitlist.findUnique({
      where: { email },
    });

    if (existingWaitlist) {
      return NextResponse.json(
        { error: "Cet email est déjà inscrit sur la liste d'attente" },
        { status: 409 }
      );
    }

    const waitlistEntry = await prisma.waitlist.create({
      data: {
        email,
        name: name || null,
        message: message || null,
        source: "PORTFOLIO",
        status: "PENDING",
      },
    });

    // 1. Envoyer confirmation au candidat
    const confirmRes = await emailService.sendWaitlistConfirmation(email);

    // 2. Notifier l'admin
    const adminRes = await emailService.notifyAdminWaitlist(email);

    if (!confirmRes.success) {
      // Email failed but entry is saved - we can retry later
      console.error("[WAITLIST_API] Erreur d'envoi d'email:", confirmRes.error);
    }

    return NextResponse.json({
      success: true,
      message: "Bienvenue sur la liste d'attente !",
      waitlistId: waitlistEntry.id,
    });

  } catch (error) {
    console.error("[WAITLIST_API_ERROR]:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
