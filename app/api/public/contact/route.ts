import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/rate-limit';

const ContactSchema = z.object({
  name: z.string().min(2, 'Nom trop court'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(10, 'Message trop court (min 10 caractères)'),
  category: z.enum(['CONTACT', 'RDV', 'SUPPORT']).default('CONTACT'),
});

export async function POST(request: Request) {
  try {
    // Rate limit - 5 messages par heure par IP
    const rateLimit = await applyRateLimit(request, 'contact');
    if (!rateLimit.allowed) {
        return rateLimit.response;
    }

    const body = await request.json();
    const parse = ContactSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({ 
        error: 'Données invalides', 
        details: parse.error.errors 
      }, { status: 400 });
    }

    const { category, ...rest } = parse.data;

    const contact = await prisma.contact.create({
      data: {
        ...rest,
        category,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Votre message a été envoyé avec succès !',
      id: contact.id
    }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/public/contact] Error:', error);
    return NextResponse.json({ 
      error: 'Une erreur est survenue lors de l\'envoi du message' 
    }, { status: 500 });
  }
}