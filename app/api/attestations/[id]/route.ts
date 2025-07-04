import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const attestation = await prisma.attestation.findUnique({
      where: { id: params.id },
      include: {
        formation: { select: { name: true, category: true, description: true, skills: true } }
      }
    });
    if (!attestation) {
      return NextResponse.json({ message: 'Attestation non trouvée' }, { status: 404 });
    }
    return NextResponse.json(attestation);
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la récupération de l'attestation" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { status } = body;
    if (!['VALIDATED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: 'Statut invalide.' }, { status: 400 });
    }
    const attestation = await prisma.attestation.update({
      where: { id: params.id },
      data: { status },
    });
    return NextResponse.json(attestation);
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la mise à jour du statut" }, { status: 500 });
  }
} 