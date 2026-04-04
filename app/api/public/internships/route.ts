import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email';
import { applyRateLimit } from '@/lib/rate-limit';
import { sanitizeInput } from '@/lib/sanitization';
import { z } from 'zod';

// ✅ VALIDATION SCHEMA
const InternshipSchema = z.object({
  fullName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(6, "Numéro de téléphone invalide"),
  position: z.string().min(2, "Poste requis"),
  university: z.string().optional(),
  level: z.string().optional(),
  cvUrl: z.string().optional(),
  message: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // ✅ RATE LIMITING - 3 candidatures maximum par heure
    const rateLimit = await applyRateLimit(request, 'internship');
    if (!rateLimit.allowed && rateLimit.response) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      console.warn(`[SECURITY] Rate limit exceeded for internship application from IP: ${ip}`);
      return rateLimit.response;
    }

    const body = await request.json();
    const parseResult = InternshipSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: "Données invalides", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { fullName, email, phone, university, level, position, cvUrl, message } = parseResult.data;

    // ✅ SANITIZATION
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedName = sanitizeInput(fullName);

    const internshipRequest = await prisma.internshipRequest.create({
      data: {
        fullName: sanitizedName,
        email: sanitizedEmail,
        phone,
        university,
        level,
        position,
        cvUrl,
        message,
        status: "PENDING"
      }
    });

    // Envoi de l'email de confirmation
    await emailService.sendInternshipConfirmation(sanitizedEmail, sanitizedName);

    return NextResponse.json(internshipRequest, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la soumission de la demande" }, { status: 500 });
  }
}
