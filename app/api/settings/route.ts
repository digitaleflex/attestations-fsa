import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { z } from "zod";

const settingsSchema = z.object({
  institutionName: z.string().min(2).max(100),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  replyTo: z.string().email(),
  targetInscriptions: z.coerce.number().int().min(1).max(10000).optional(),
  targetAttestations: z.coerce.number().int().min(1).max(10000).optional(),
  targetValidations: z.coerce.number().int().min(1).max(10000).optional(),
});

// GET /api/settings
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const settings = await prisma.settings.findFirst();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/settings
export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides", details: parsed.error.errors }, { status: 400 });
    }
    const { institutionName, logoUrl, replyTo, targetInscriptions, targetAttestations, targetValidations } = parsed.data;
    
    let settings = await prisma.settings.findFirst();
    
    const data = {
      institutionName,
      logoUrl: logoUrl || null,
      replyTo,
      ...(targetInscriptions !== undefined && { targetInscriptions }),
      ...(targetAttestations !== undefined && { targetAttestations }),
      ...(targetValidations !== undefined && { targetValidations }),
    };

    if (!settings) {
      settings = await prisma.settings.create({ data });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data,
      });
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}