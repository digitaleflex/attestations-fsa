import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email';
import { applyRateLimit } from '@/lib/rate-limit';
import { sanitizeInput } from '@/lib/sanitization';
import { notifyAllAdmins } from '@/lib/notifications';
import { buildObjectKey, getStorage, validateUpload } from '@/lib/storage';
import { StorageConfigError } from '@/lib/storage/types';
import { z } from 'zod';

const MAX_INTERNSHIP_CV_SIZE = 3 * 1024 * 1024;

// ✅ VALIDATION SCHEMA
const InternshipSchema = z.object({
  fullName: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(120),
  email: z.string().trim().email("Email invalide").max(254),
  phone: z.string().trim().min(6, "Numéro de téléphone invalide").max(40),
  position: z.string().trim().min(2, "Poste requis").max(120),
  university: z.string().trim().max(180).optional(),
  level: z.string().trim().max(120).optional(),
  message: z.string().trim().min(1, "La motivation est requise").max(5000),
});

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export async function POST(request: NextRequest) {
  try {
    // ✅ RATE LIMITING
    const rateLimit = await applyRateLimit(request, 'internship');
    if (!rateLimit.allowed && rateLimit.response) {
      return rateLimit.response;
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        { message: "Envoyez le formulaire et le CV au format multipart/form-data" },
        { status: 415 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "CV requis" }, { status: 400 });
    }
    if (file.size > MAX_INTERNSHIP_CV_SIZE) {
      return NextResponse.json(
        { message: "Fichier trop volumineux (max 3 Mo)" },
        { status: 400 }
      );
    }

    // La validation porte sur la taille, le MIME déclaré et les magic bytes.
    // Le contenu est chargé seulement après le contrôle de taille annoncé.
    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateUpload(
      { size: file.size, type: file.type, name: file.name },
      bytes
    );
    if (!validation.ok) {
      return NextResponse.json({ message: validation.error }, { status: 400 });
    }
    if (validation.mime !== 'application/pdf') {
      return NextResponse.json(
        { message: "Le CV doit être un fichier PDF" },
        { status: 400 }
      );
    }

    const parseResult = InternshipSchema.safeParse({
      fullName: textField(formData, 'fullName'),
      email: textField(formData, 'email'),
      phone: textField(formData, 'phone'),
      position: textField(formData, 'position'),
      university: textField(formData, 'university'),
      level: textField(formData, 'level'),
      message: textField(formData, 'message'),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { message: "Données invalides", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { fullName, email, phone, university, level, position, message } = parseResult.data;
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedName = sanitizeInput(fullName);

    const storage = getStorage();
    const key = buildObjectKey('application/pdf');
    await storage.put(key, bytes, validation.mime);
    const cvUrl = await storage.getSignedUrl(key);

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
    if (error instanceof StorageConfigError) {
      console.error("[INTERNSHIP_STORAGE_CONFIG_ERROR]", error.message);
      return NextResponse.json(
        { message: "Stockage des fichiers mal configuré" },
        { status: 500 }
      );
    }
    console.error("[INTERNSHIP_POST_ERROR]", error);
    return NextResponse.json({ message: "Erreur lors de la soumission de la demande" }, { status: 500 });
  }
}
