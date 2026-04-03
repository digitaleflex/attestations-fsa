import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated, getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

// Schéma de validation pour la mise à jour d'une attestation
const AttestationUpdateSchema = z.object({
  type: z.enum(['FORMATION', 'STAGE', 'CERTIFICATION']).optional(),
  status: z.enum(['PENDING', 'VALIDATED', 'REJECTED']).optional(),
  gender: z.enum(['M', 'F']).optional(),
  fullName: z.string().min(1, "Le nom complet est obligatoire.").optional(),
  birthDate: z.string().min(1, "La date de naissance est obligatoire.").optional(),
  birthPlace: z.string().min(1, "Le lieu de naissance est obligatoire.").optional(),
  formation: z.string().min(1, "La formation est obligatoire.").optional(),
  startDate: z.string().min(1, "La date de début est obligatoire.").optional(),
  endDate: z.string().min(1, "La date de fin est obligatoire.").optional(),
  location: z.string().min(1, "Le lieu est obligatoire.").optional(),
  instructor: z.string().min(1, "Le formateur est obligatoire.").optional(),
  issuingCompany: z.string().min(1, "La société émettrice est obligatoire.").optional(),
  
  // Champs spécifiques pour STAGE
  stageHours: z.number().min(1).max(2000).optional(),
  stageScore: z.number().min(0).max(100).optional(),
  stageObservations: z.string().max(1000).optional(),
  
  // Champs spécifiques pour CERTIFICATION
  certificationMention: z.enum(['PASSABLE', 'ASSEZ_BIEN', 'BIEN', 'TRES_BIEN', 'EXCELLENCE']).optional(),
  certificationScore: z.number().min(0).max(100).optional(),
  certificationHours: z.number().min(1).max(2000).optional(),
  certificationObservations: z.string().max(1000).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  const isAdmin = await isAdminAuthenticated(request);
  
  if (!user && !isAdmin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const attestation = await prisma.attestation.findUnique({
      where: { id },
      include: {
        formation: { select: { name: true, category: true, description: true, skills: true } }
      }
    });

    if (!attestation) {
      return NextResponse.json({ message: 'Attestation non trouvée' }, { status: 404 });
    }

    // Sécurité: Un simple utilisateur ne peut voir que SA propre attestation
    if (!isAdmin && attestation.userId !== user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    return NextResponse.json(attestation);
  } catch (error) {
    console.error("Erreur lors de la récupération de l'attestation:", error);
    return NextResponse.json({ message: "Erreur lors de la récupération de l'attestation" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    // Validation stricte avec zod
    const parse = AttestationUpdateSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: "Entrée invalide", details: parse.error.errors }, { status: 400 });
    }
    const data = parse.data;
    // Validation de cohérence des dates
    if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
      return NextResponse.json({ field: 'endDate', message: "La date de fin doit être postérieure à la date de début." }, { status: 400 });
    }
    if (data.birthDate && data.startDate && new Date(data.birthDate) > new Date(data.startDate)) {
      return NextResponse.json({ field: 'birthDate', message: "La date de naissance doit précéder la date de début." }, { status: 400 });
    }
    // Gestion formation (si modifiée)
    let formationId = undefined;
    if (data.formation) {
      let formationRecord = await prisma.formation.findFirst({ where: { name: data.formation } });
      if (!formationRecord) {
        formationRecord = await prisma.formation.create({ data: { name: data.formation, category: '', skills: [] } });
      }
      formationId = formationRecord.id;
    }
    // Construction des données à mettre à jour
    const updateData: any = { ...data };
    if (formationId) {
      updateData.formationId = formationId;
      delete updateData.formation;
    }
    // Conversion des dates en Date
    if (updateData.birthDate) updateData.birthDate = new Date(updateData.birthDate);
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
    // Mise à jour
    const attestation = await prisma.attestation.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(attestation);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'attestation:", error);
    return NextResponse.json({ message: "Erreur lors de la mise à jour de l'attestation" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await prisma.attestation.delete({ where: { id } });
    return NextResponse.json({ message: 'Attestation supprimée' });
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la suppression de l'attestation" }, { status: 500 });
  }
} 