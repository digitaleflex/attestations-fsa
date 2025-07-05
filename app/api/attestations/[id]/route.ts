import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET(request: Request) {
  if (!isAdminAuthenticated()) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  // Récupérer l'id depuis l'URL
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
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
    return NextResponse.json(attestation);
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la récupération de l'attestation" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminAuthenticated()) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  // Récupérer l'id depuis l'URL
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  try {
    const body = await request.json();
    const allowedTypes = ['FORMATION', 'STAGE', 'CERTIFICATION'];
    const allowedStatus = ['PENDING', 'VALIDATED', 'REJECTED'];
    // Validation structurée
    if (body.type && !allowedTypes.includes(body.type)) {
      return NextResponse.json({ field: 'type', message: "Type d'attestation invalide." }, { status: 400 });
    }
    if (body.status && !allowedStatus.includes(body.status)) {
      return NextResponse.json({ field: 'status', message: "Statut invalide." }, { status: 400 });
    }
    if (body.fullName !== undefined && !body.fullName) {
      return NextResponse.json({ field: 'fullName', message: "Le nom complet est obligatoire." }, { status: 400 });
    }
    if (body.birthDate !== undefined && !body.birthDate) {
      return NextResponse.json({ field: 'birthDate', message: "La date de naissance est obligatoire." }, { status: 400 });
    }
    if (body.birthPlace !== undefined && !body.birthPlace) {
      return NextResponse.json({ field: 'birthPlace', message: "Le lieu de naissance est obligatoire." }, { status: 400 });
    }
    if (body.formation !== undefined && !body.formation) {
      return NextResponse.json({ field: 'formation', message: "La formation est obligatoire." }, { status: 400 });
    }
    if (body.startDate !== undefined && !body.startDate) {
      return NextResponse.json({ field: 'startDate', message: "La date de début est obligatoire." }, { status: 400 });
    }
    if (body.endDate !== undefined && !body.endDate) {
      return NextResponse.json({ field: 'endDate', message: "La date de fin est obligatoire." }, { status: 400 });
    }
    if (body.location !== undefined && !body.location) {
      return NextResponse.json({ field: 'location', message: "Le lieu est obligatoire." }, { status: 400 });
    }
    if (body.instructor !== undefined && !body.instructor) {
      return NextResponse.json({ field: 'instructor', message: "Le formateur est obligatoire." }, { status: 400 });
    }
    if (body.issuingCompany !== undefined && !body.issuingCompany) {
      return NextResponse.json({ field: 'issuingCompany', message: "La société émettrice est obligatoire." }, { status: 400 });
    }
    // Validation de cohérence des dates
    if (body.startDate && body.endDate && new Date(body.startDate) > new Date(body.endDate)) {
      return NextResponse.json({ field: 'endDate', message: "La date de fin doit être postérieure à la date de début." }, { status: 400 });
    }
    if (body.birthDate && body.startDate && new Date(body.birthDate) > new Date(body.startDate)) {
      return NextResponse.json({ field: 'birthDate', message: "La date de naissance doit précéder la date de début." }, { status: 400 });
    }
    // Gestion formation (si modifiée)
    let formationId = undefined;
    if (body.formation) {
      let formationRecord = await prisma.formation.findFirst({ where: { name: body.formation } });
      if (!formationRecord) {
        formationRecord = await prisma.formation.create({ data: { name: body.formation, category: '', skills: [] } });
      }
      formationId = formationRecord.id;
    }
    // Construction des données à mettre à jour
    const updateData: any = { ...body };
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
    return NextResponse.json({ message: "Erreur lors de la mise à jour de l'attestation" }, { status: 500 });
  }
} 