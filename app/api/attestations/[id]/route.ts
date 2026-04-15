import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getAdminUser } from '@/lib/auth';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';

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
  certificationHoursExempted: z.number().optional(),
  certificationObservations: z.string().max(1000).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  const adminUser = await getAdminUser(request);

  if (!user && !adminUser) {
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
    if (!adminUser && attestation.userId !== user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Sécurité supplémentaire: Vérifier si l'attestation est verrouillée par la délibération
    if (!adminUser) {
      const session = await prisma.examSession.findFirst({
        where: {
          userId: user!.id,
          exam: {
            formationId: attestation.formationId,
            type: 'OFFICIAL'
          }
        },
        include: {
          exam: {
            select: { showResults: true }
          }
        },
        orderBy: { startedAt: 'desc' }
      });

      // Si deliberé/showResults est false, on bloque l'accès
      if (session && !session.exam.showResults) {
        return NextResponse.json(
          { error: 'Cette attestation sera disponible après la délibération finale.' }, 
          { status: 403 }
        );
      }
    }

    // Sécurité supplémentaire: Masquer le code officiel si l'attestation n'est pas encore validée (hors admin)
    if (!adminUser && attestation.status !== 'VALIDATED' && attestation.status !== 'CLAIMED') {
       return NextResponse.json({
         ...attestation,
         code: "••••-••••-••••"
       });
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
  const { id } = await params;
  const adminUser = await getAdminUser(request);

  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parse = AttestationUpdateSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: "Entrée invalide", details: parse.error.errors }, { status: 400 });
    }
    const data = parse.data;

    // Validation dates
    if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
      return NextResponse.json({ field: 'endDate', message: "La date de fin doit être postérieure à la date de début." }, { status: 400 });
    }

    // Gestion formation
    let formationId = undefined;
    if (data.formation) {
      let formationRecord = await prisma.formation.findFirst({ where: { name: data.formation } });
      if (!formationRecord) {
        formationRecord = await prisma.formation.create({ data: { name: data.formation, category: '', skills: [] } });
      }
      formationId = formationRecord.id;
    }

    const updateData: Record<string, unknown> = { ...data };
    if (formationId) {
      updateData.formationId = formationId;
      delete updateData.formation;
    }

    if (updateData.birthDate) updateData.birthDate = new Date(updateData.birthDate as string);
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate as string);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate as string);

    const oldAttestation = await prisma.attestation.findUnique({ 
      where: { id },
      select: { status: true, userId: true, fullName: true, code: true }
    });
    
    const attestation = await prisma.attestation.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: updateData as any,
    });

    // Notifications
    if (oldAttestation?.userId && data.status && oldAttestation.status !== data.status) {
      if (data.status === 'VALIDATED') {
        await createNotification({
          userId: oldAttestation.userId,
          type: 'ATTESTATION_VALIDATED',
          title: 'Attestation validée ! 🎉',
          message: `Votre attestation "${oldAttestation.fullName}" (${oldAttestation.code}) a été validée avec succès.`,
          link: `/attestations/${id}`,
        });
      } else if (data.status === 'REJECTED') {
        await createNotification({
          userId: oldAttestation.userId,
          type: 'ATTESTATION_REJECTED',
          title: 'Attestation rejetée',
          message: `Votre attestation "${oldAttestation.fullName}" (${oldAttestation.code}) a été rejetée.`,
          link: `/attestations/${id}`,
        });
      }
    }

    // Audit Log
    if (adminUser) {
      await createAuditLog({
        userId: adminUser.id,
        action: data.status === 'VALIDATED' ? 'ATTESTATION_VALIDATED' : 'ATTESTATION_UPDATED',
        resource: 'ATTESTATION',
        resourceId: id,
        oldValue: oldAttestation,
        newValue: { 
          status: data.status, 
          adminId: adminUser.id, 
          adminName: adminUser.name 
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown"
      });
    }

    return NextResponse.json(attestation);
  } catch (error) {
    console.error("PATCH Attestation Error:", error);
    return NextResponse.json({ message: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminUser = await getAdminUser(request);

  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const old = await prisma.attestation.findUnique({ where: { id } });
    await prisma.attestation.delete({ where: { id } });

    if (adminUser && old) {
      await createAuditLog({
        userId: adminUser.id,
        action: 'ATTESTATION_DELETED',
        resource: 'ATTESTATION',
        resourceId: id,
        oldValue: old,
        newValue: { 
          adminId: adminUser.id, 
          adminName: adminUser.name,
          deletedCode: old.code 
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown"
      });
    }

    return NextResponse.json({ message: 'Attestation supprimée' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la suppression" }, { status: 500 });
  }
}