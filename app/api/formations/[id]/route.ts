import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { z } from 'zod';

// Schéma de validation pour la modification d'une formation
const FormationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').optional(),
  category: z.string().min(1, 'La catégorie est requise.').optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  const { id } = params;
  try {
    const body = await request.json();
    const parse = FormationSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ message: 'Entrée invalide', details: parse.error.errors }, { status: 400 });
    }
    const data = parse.data;
    const formation = await prisma.formation.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.skills !== undefined ? { skills: data.skills } : {}),
      },
    });
    return NextResponse.json(formation);
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la modification de la formation" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  const { id } = params;
  try {
    await prisma.formation.delete({ where: { id } });
    return NextResponse.json({ message: 'Formation supprimée' });
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la suppression de la formation" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  const { id } = params;
  try {
    const formation = await prisma.formation.findUnique({ where: { id } });
    if (!formation) {
      return NextResponse.json({ message: 'Formation non trouvée' }, { status: 404 });
    }
    return NextResponse.json(formation);
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la récupération de la formation" }, { status: 500 });
  }
} 