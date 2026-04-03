import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('1234567890abcdef', 5);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params; // InternshipRequest ID
    const body = await request.json();
    const { startDate, endDate, location, instructor, stageScore, stageObservations } = body;

    // 1. Récupérer la demande de stage
    const internship = await prisma.internshipRequest.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!internship) {
      return NextResponse.json({ message: "Demande non trouvée" }, { status: 404 });
    }

    // 2. Trouver ou créer une formation "Stage" pour le domaine
    // On essaie de trouver une formation qui correspond au "position" (ex: "Pisciculture")
    let formation = await prisma.formation.findFirst({
        where: { name: { contains: internship.position, mode: 'insensitive' } }
    });

    // Si non trouvé, on prend la première ou on en crée une générique
    if (!formation) {
        formation = await prisma.formation.findFirst({
            where: { category: 'STAGE' }
        });
        
        if (!formation) {
            formation = await prisma.formation.create({
                data: {
                    name: `Stage en ${internship.position}`,
                    category: 'STAGE',
                    description: 'Stage pratique professionnel'
                }
            });
        }
    }

    // 3. Récupérer les réglages pour l'identité visuelle
    const settings = await prisma.settings.findFirst();

    // 4. Générer le code d'attestation unique
    const now = new Date();
    const year = now.getFullYear();
    const month = `M${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.attestation.count({
        where: {
            issuedAt: {
                gte: new Date(year, now.getMonth(), 1),
                lt: new Date(year, now.getMonth() + 1, 1)
            }
        }
    });
    const seq = String(count + 1).padStart(5, '0');
    const hash = nanoid();
    const attestationCode = `FSA-${year}-${month}-${seq}-${hash}`;

    // 5. Créer l'attestation
    const attestation = await prisma.attestation.create({
      data: {
        code: attestationCode,
        type: 'STAGE',
        fullName: internship.fullName,
        birthDate: internship.user?.birthDate || new Date(1995, 0, 1),
        birthPlace: internship.user?.birthPlace || "Non spécifié",
        formationId: formation.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location: location || settings?.location || "Abomey-Calavi",
        instructor: instructor || settings?.instructorName || "Ferme St André",
        issuingCompany: settings?.institutionName || "Ferme Agro-Piscicole Cité St André",
        status: 'VALIDATED',
        stageScore: parseFloat(stageScore || "100"),
        stageObservations: stageObservations || "Stage terminé avec succès.",
        userId: internship.userId,
      }
    });

    // 5. Archiver la demande de stage
    await prisma.internshipRequest.update({
      where: { id },
      data: { status: 'ARCHIVED' }
    });

    return NextResponse.json({
      message: "Attestation de stage générée avec succès",
      code: attestation.code,
      id: attestation.id
    });

  } catch (error) {
    console.error("[INTERNSHIP_ATTESTATION_ERROR]", error);
    return NextResponse.json({ 
        message: "Erreur lors de la génération de l'attestation",
        error: error instanceof Error ? error.message : "Inconnue"
    }, { status: 500 });
  }
}
