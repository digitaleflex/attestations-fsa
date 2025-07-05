import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { z } from "zod";

const settingsSchema = z.object({
  institutionName: z.string().min(2).max(100),
  logoUrl: z.string().url().optional().nullable(),
  replyTo: z.string().email(),
});

// GET /api/settings
export async function GET() {
  if (!isAdminAuthenticated()) {
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
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides", details: parsed.error.errors }, { status: 400 });
    }
    const { institutionName, logoUrl, replyTo } = parsed.data;
    
    let settings = await prisma.settings.findFirst();
    
    if (!settings) {
      settings = await prisma.settings.create({ 
        data: { institutionName, logoUrl, replyTo } 
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: { institutionName, logoUrl, replyTo },
      });
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}