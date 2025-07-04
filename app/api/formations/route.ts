import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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
  try {
    const body = await request.json();
    const { name, category, description, skills } = body;
    if (!name || !category) {
      return NextResponse.json({ message: 'Le nom et la catégorie sont requis.' }, { status: 400 });
    }
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