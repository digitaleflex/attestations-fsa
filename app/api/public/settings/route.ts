import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const settings = await prisma.settings.findFirst({
        select: {
            institutionName: true,
            institutionLogo: true,
            instructorName: true,
            instructorTitle: true,
            signatureUrl: true,
            location: true,
            supportEmail: true
        }
    });

    if (!settings) {
        return NextResponse.json({
            institutionName: "Ferme Agro-Piscicole Cité St André",
            location: "Abomey-Calavi",
            instructorName: "Directeur Technique",
            instructorTitle: "Responsable des Formations",
            supportEmail: "contact@fsa.bj"
        });
    }

    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ message: "Erreur" }, { status: 500 });
  }
}
