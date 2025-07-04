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