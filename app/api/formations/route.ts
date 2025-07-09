import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { z } from 'zod';

// Schéma de validation pour la création d'une formation
const FormationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.'),
  category: z.string().min(1, 'La catégorie est requise.'),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  try {
    const formations = await prisma.formation.findMany({
      select: { id: true, name: true }
    });
    return NextResponse.json(formations);
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la récupération des formations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  try {
    const body = await request.json();
    const parse = FormationSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ message: 'Entrée invalide', details: parse.error.errors }, { status: 400 });
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
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la création de la formation" }, { status: 500 });
  }
} 