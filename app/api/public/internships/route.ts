import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email';
import { applyRateLimit } from '@/lib/rate-limit';
import { sanitizeInput } from '@/lib/sanitization';
import { notifyAllAdmins } from '@/lib/notifications';
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
    // ✅ RATE LIMITING
    const rateLimit = await applyRateLimit(request, 'internship');
    if (!rateLimit.allowed && rateLimit.response) {
      return rateLimit.response;
    }

    const contentType = request.headers.get('content-type') || '';
    let data: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      data = {
        fullName: formData.get('fullName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        position: formData.get('position'),
        university: formData.get('university'),
        level: formData.get('level'),
        cvUrl: formData.get('cvUrl'), // Base64 or we handle file here
        message: formData.get('message'),
      };
    } else {
      data = await request.json();
    }

    const parseResult = InternshipSchema.safeParse(data);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: "Données invalides", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { fullName, email, phone, university, level, position, cvUrl, message } = parseResult.data;

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

    await emailService.sendInternshipConfirmation(sanitizedEmail, sanitizedName);

    // Notifier tous les admins
    await notifyAllAdmins({
      type: 'GENERAL',
      title: '📋 Nouvelle demande de stage',
      message: `${sanitizedName} a postulé pour le poste "${position}".`,
      link: '/admin/internships',
      metadata: { internshipRequestId: internshipRequest.id, email: sanitizedEmail },
    });

    return NextResponse.json(internshipRequest, { status: 201 });
  } catch (error) {
    console.error("[INTERNSHIP_POST_ERROR]", error);
    return NextResponse.json({ message: "Erreur lors de la soumission de la demande" }, { status: 500 });
  }
}
