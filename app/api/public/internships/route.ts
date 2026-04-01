import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, phone, university, level, position, cvUrl, message } = body;

    if (!fullName || !email || !phone || !position) {
      return NextResponse.json({ message: "Champs obligatoires manquants" }, { status: 400 });
    }

    const internshipRequest = await prisma.internshipRequest.create({
      data: {
        fullName,
        email,
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
    await emailService.sendInternshipConfirmation(email, fullName);

    return NextResponse.json(internshipRequest, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la soumission de la demande" }, { status: 500 });
  }
}
