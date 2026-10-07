import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getAdminUser } from '@/lib/auth';
import { z } from 'zod';
import { createNotification, notifyAllAdmins } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';
import { sanitizeInput } from '@/lib/sanitization';
import {
  ATTESTATION_ALREADY_SOFT_DELETED,
  ATTESTATION_PHYSICAL_DELETE_REFUSED,
  PHYSICAL_DELETE_REFUSED_MESSAGE,
  notificationAudience,
  parseLifecycleReason,
  softDeletePlan,
} from '@/lib/attestations/lifecycle';
import { Prisma } from '@prisma/client';
import {
  CERTIFICATE_SEAL_VERSION,
  sealCertificate,
  type CertificateSealPayload,
} from '@/lib/crypto/seal';
import { generateOfficialPdf, OfficialPdfUnavailableError } from '@/lib/attestations/pdf';

// Schéma de validation pour la mise à jour d'une attestation
const AttestationUpdateSchema = z.object({
  type: z.enum(['FORMATION', 'STAGE', 'CERTIFICATION']).optional(),
  status: z.enum(['PENDING', 'VALIDATED', 'REJECTED']).optional(),
  gender: z.enum(['M', 'F']).optional(),
  fullName: z.string().min(1, "Le nom complet est obligatoire.").optional(),
  email: z.string().email('Adresse e-mail invalide.').optional().or(z.literal('')),
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

    // #322 — Refuser les champs non persistés. `certificationHoursExempted`
    // n'existe pas dans le schéma Prisma : accepter ce champ permettrait à
    // un client de croire qu'une exemption est enregistrée alors qu'elle
    // serait silencieusement ignorée.
    if (body && typeof body === 'object' && 'certificationHoursExempted' in body) {
      return NextResponse.json(
        { error: "Champ non persisté", field: "certificationHoursExempted", message: "Le champ certificationHoursExempted n'est pas accepté." },
        { status: 400 }
      );
    }

    // Sanitize all text fields before storing
    const TEXT_FIELDS = ['fullName', 'birthPlace', 'location', 'instructor', 'issuingCompany', 'formation', 'stageObservations', 'certificationObservations'] as const;
    for (const field of TEXT_FIELDS) {
      if (typeof data[field as keyof typeof data] === 'string') {
        (data as Record<string, unknown>)[field] = sanitizeInput(data[field as keyof typeof data] as string);
      }
    }

    // Validation dates
    if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
      return NextResponse.json({ field: 'endDate', message: "La date de fin doit être postérieure à la date de début." }, { status: 400 });
    }

    // #322 — Invariants par type : une attestation CERTIFICATION ne peut être
    // validée sans score, mention ni heures ; une attestation STAGE ne peut
    // l'être sans heures. On détermine le type APRÈS application du patch
    // (nouveau type si fourni, sinon type existant en base).
    const oldAttestation = await prisma.attestation.findUnique({
      where: { id },
      include: { formation: { select: { name: true } } },
    });
    if (!oldAttestation) {
      return NextResponse.json({ message: "Attestation non trouvée" }, { status: 404 });
    }
    const effectiveType = data.type ?? oldAttestation.type;

    if (effectiveType === 'CERTIFICATION') {
      const missing: string[] = [];
      if (data.certificationScore === undefined && oldAttestation.certificationScore == null) missing.push('certificationScore');
      if (data.certificationMention === undefined && oldAttestation.certificationMention == null) missing.push('certificationMention');
      if (data.certificationHours === undefined && oldAttestation.certificationHours == null) missing.push('certificationHours');
      if (missing.length > 0) {
        return NextResponse.json(
          { error: "Champs requis pour CERTIFICATION", fields: missing, message: `Une attestation CERTIFICATION requiert : ${missing.join(', ')}.` },
          { status: 400 }
        );
      }
    }
    if (effectiveType === 'STAGE') {
      if (data.stageHours === undefined && oldAttestation.stageHours == null) {
        return NextResponse.json(
          { error: "Champ requis pour STAGE", fields: ['stageHours'], message: "Une attestation STAGE requiert stageHours." },
          { status: 400 }
        );
      }
    }

    // Gestion formation
    let formationId = undefined;
    let newFormationName: string | null = null;
    if (data.formation) {
      let formationRecord = await prisma.formation.findFirst({ where: { name: data.formation } });
      if (!formationRecord) {
        formationRecord = await prisma.formation.create({ data: { name: data.formation, category: '', skills: [] } });
      }
      formationId = formationRecord.id;
      newFormationName = formationRecord.name;
    }

    const updateData: Record<string, unknown> = { ...data };
    if (formationId) {
      updateData.formationId = formationId;
      delete updateData.formation;
    }

    if (updateData.email === "") {
      updateData.email = null;
    } else if (typeof updateData.email === "string") {
      updateData.email = updateData.email.trim().toLowerCase();
    }

    if (updateData.birthDate) updateData.birthDate = new Date(updateData.birthDate as string);
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate as string);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate as string);

    // Une mutation autorisée d'une attestation officielle doit produire un
    // nouveau PDF et un nouveau sceau. On échoue avant l'update si le serveur
    // ne peut pas garantir ce nouveau document.
    if (oldAttestation.type === 'CERTIFICATION' && oldAttestation.sessionId) {
      const merged = { ...oldAttestation, ...updateData } as typeof oldAttestation & Record<string, unknown>;
      const status = (updateData.status ?? oldAttestation.status) as string;
      const base: CertificateSealPayload = {
        sealVersion: CERTIFICATE_SEAL_VERSION,
        code: oldAttestation.code,
        type: oldAttestation.type,
        status,
        sessionId: oldAttestation.sessionId,
        userId: oldAttestation.userId,
        formationId: oldAttestation.formationId,
        formationName: newFormationName ?? oldAttestation.formation.name,
        fullName: (merged.fullName as string) ?? oldAttestation.fullName,
        email: (merged.email as string | null) ?? oldAttestation.email,
        gender: (merged.gender as string | null) ?? oldAttestation.gender,
        birthDate: (merged.birthDate as Date) ?? oldAttestation.birthDate,
        birthPlace: (merged.birthPlace as string) ?? oldAttestation.birthPlace,
        startDate: (merged.startDate as Date) ?? oldAttestation.startDate,
        endDate: (merged.endDate as Date) ?? oldAttestation.endDate,
        issuedAt: oldAttestation.issuedAt,
        location: (merged.location as string) ?? oldAttestation.location,
        instructor: (merged.instructor as string) ?? oldAttestation.instructor,
        issuingCompany: (merged.issuingCompany as string) ?? oldAttestation.issuingCompany,
        certificationHours: (merged.certificationHours as number | null) ?? oldAttestation.certificationHours,
        certificationMention: (merged.certificationMention as string | null) ?? oldAttestation.certificationMention,
        certificationObservations: (merged.certificationObservations as string | null) ?? oldAttestation.certificationObservations,
        certificationScore: (merged.certificationScore as number | null) ?? oldAttestation.certificationScore,
        stageHours: (merged.stageHours as number | null) ?? oldAttestation.stageHours,
        stageObservations: (merged.stageObservations as string | null) ?? oldAttestation.stageObservations,
        stageScore: (merged.stageScore as number | null) ?? oldAttestation.stageScore,
        pdfKey: oldAttestation.pdfKey,
        pdfHash: oldAttestation.pdfHash,
        pdfVersion: oldAttestation.pdfVersion,
        pdfGeneratedAt: oldAttestation.pdfGeneratedAt,
      };
      const proof = status === 'REJECTED'
        ? {
            pdfKey: oldAttestation.pdfKey,
            pdfHash: oldAttestation.pdfHash,
            pdfVersion: oldAttestation.pdfVersion,
            pdfGeneratedAt: oldAttestation.pdfGeneratedAt,
          }
        : await generateOfficialPdf(base, oldAttestation.pdfVersion);
      const seal = sealCertificate({ ...base, ...proof });
      if (!seal) {
        return NextResponse.json({ message: "Mutation bloquée : clé de scellement indisponible" }, { status: 503 });
      }
      Object.assign(updateData, proof, {
        pdfUrl: null,
        sealHash: seal.sealHash,
        sealedAt: seal.sealedAt,
        sealVersion: seal.sealVersion,
      });
    }

    const attestation = await prisma.attestation.update({
      where: { id },
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
    if (error instanceof OfficialPdfUnavailableError) {
      return NextResponse.json({ message: "Mutation bloquée : le PDF serveur probant est indisponible" }, { status: 503 });
    }
    console.error("PATCH Attestation Error:", error);
    return NextResponse.json({ message: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}

// #299 — La suppression physique d'une attestation émise est INTERDIE.
//
// Une attestation validée ou récupérée porte un code imprimé, un PDF serveur,
// son hash et son sceau : la retirer de la base rendrait un document vérifié
// caduc en silence, et le tiers qui l'a vérifié n'en saurait rien. Le DELETE
// est donc une suppression LOGIQUE :
//   - un MOTIF est obligatoire (400 `MOTIF_REQUIS` sans motif exploitable) ;
//   - `deletedAt` + `deletedById` + `deleteReason` sont écrits ;
//   - si l'attestation était VALIDATED/CLAIMED, elle est PUBLIQUEMENT RÉVOQUÉE
//     (statut REVOKED + `revokedAt` + auteur + motif) ;
//   - PDF, hash, sceau, code et audit sont intacts ;
//   - une demande explicite de purge physique est refusée (409).
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
    let body: Record<string, unknown> = {};
    try {
      const parsedBody = (await request.json()) as unknown;
      if (parsedBody && typeof parsedBody === "object") {
        body = parsedBody as Record<string, unknown>;
      }
    } catch {
      // Corps vide ou non JSON : traité comme une absence de motif (400).
      body = {};
    }

    // Purge physique : refus explicite, aucune écriture.
    if (body.purge === true || body.physical === true) {
      return NextResponse.json(
        {
          error: PHYSICAL_DELETE_REFUSED_MESSAGE,
          code: ATTESTATION_PHYSICAL_DELETE_REFUSED,
          hint: 'Utilisez DELETE { "reason": "..." } : suppression logique avec motif.',
        },
        { status: 409 },
      );
    }

    const parsed = parseLifecycleReason(body.reason);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.message, code: 'MOTIF_REQUIS' },
        { status: 400 },
      );
    }

    const old = await prisma.attestation.findUnique({
      where: { id },
      include: { formation: { select: { name: true } } },
    });
    if (!old) {
      return NextResponse.json({ message: 'Attestation non trouvée' }, { status: 404 });
    }

    if (old.deletedAt) {
      return NextResponse.json(
        {
          error: 'Cette attestation est déjà supprimée logiquement.',
          code: ATTESTATION_ALREADY_SOFT_DELETED,
          deletedAt: old.deletedAt,
        },
        { status: 409 },
      );
    }

    const plan = softDeletePlan(old, {
      reason: parsed.reason,
      actorId: adminUser.id,
      now: new Date(),
    });

    const updated = await prisma.attestation.update({
      where: { id },
      data: plan.data as Prisma.AttestationUncheckedUpdateInput,
    });

    const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
    const formationName = old.formation?.name ?? "la formation";

    // Audit : le soft-delete est TOUJOURS journalisé, même pour un historique
    // anonyme, et il porte la nature de l'opération (`softDelete: true`).
    await createAuditLog({
      userId: adminUser.id,
      action: 'ATTESTATION_DELETED',
      resource: 'ATTESTATION',
      resourceId: id,
      oldValue: { status: plan.previousStatus, deletedAt: null, revokedAt: old.revokedAt },
      newValue: {
        adminId: adminUser.id,
        adminName: adminUser.name,
        reason: parsed.reason,
        softDelete: true,
        deletedCode: old.code,
        physicalDelete: false,
      },
      ipAddress,
    });

    if (plan.revoked) {
      await createAuditLog({
        userId: adminUser.id,
        action: 'ATTESTATION_REVOKED',
        resource: 'ATTESTATION',
        resourceId: id,
        oldValue: { status: plan.previousStatus },
        newValue: {
          adminId: adminUser.id,
          adminName: adminUser.name,
          reason: parsed.reason,
          revokedBySoftDelete: true,
        },
        ipAddress,
      });
    }

    // Notification : le titulaire s'il existe, sinon les administrateurs —
    // une attestation historique anonyme ne doit jamais être retirée en silence.
    const audience = notificationAudience(old);
    if (audience.kind === "user") {
      await createNotification({
        userId: audience.userId,
        type: 'ATTESTATION_REJECTED',
        title: plan.revoked ? 'Attestation révoquée ❌' : 'Attestation retirée',
        message: plan.revoked
          ? `Votre attestation "${old.code}" pour "${formationName}" a été révoquée par l'administration. Motif : ${parsed.reason}`
          : `Votre attestation "${old.code}" pour "${formationName}" a été retirée par l'administration. Motif : ${parsed.reason}`,
        link: '/results',
      });
    } else {
      await notifyAllAdmins({
        type: 'ATTESTATION_REJECTED',
        title: 'Attestation historique retirée',
        message: `L'attestation ${old.code} (${old.fullName}, ${formationName}) a été supprimée logiquement${plan.revoked ? ' et révoquée' : ''}. Aucun compte candidat associé — suivi requis. Motif : ${parsed.reason}`,
        link: `/admin/attestations/${id}`,
      });
    }

    return NextResponse.json({
      message: 'Attestation supprimée logiquement',
      softDeleted: true,
      physicalDelete: false,
      revoked: plan.revoked,
      attestation: updated,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la suppression logique" }, { status: 500 });
  }
}