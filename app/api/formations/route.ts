import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

// Schéma de validation pour la création d'une formation
const FormationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.'),
  category: z.string().min(1, 'La catégorie est requise.'),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
  const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;
  const search = url.searchParams.get('search') || '';
  try {
    // ✅ FIX: Use Prisma type instead of `any`
    const where: Prisma.FormationWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const formations = await prisma.formation.findMany({
      where,
      select: { id: true, name: true, category: true, description: true },
      ...(limit ? { take: limit } : {}),
      skip: offset,
    });
    return NextResponse.json(formations);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur lors de la récupération des formations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  try {
    const body = await request.json();
    const parse = FormationSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Entrée invalide', details: parse.error.errors }, { status: 400 });
    }
    const { name, category, description, skills } = parse.data;
    const formation = await prisma.formation.create({
      data: {
        name,
        category,
        description: description || '',
        skills: Array.isArray(skills) ? skills : [],
      }
    });
    return NextResponse.json(formation, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur lors de la création de la formation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
