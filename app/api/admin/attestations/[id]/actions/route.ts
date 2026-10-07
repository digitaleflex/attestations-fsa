// #301 — Actions de cycle de vie NON destructives.
//
//  REVOKE      : `status = REVOKED` + `revokedAt` + `revokedById` + motif.
//                L'attestation reste en base, vérifiable et scellée ; elle
//                n'est simplement plus opposable. La ligne reste lisible par
//                le vérificateur public, qui y konstatera la révocation.
//  RETROGRADE  : la session probante est ARCHIVÉE (statut `ARCHIVED` + date +
//                motif) — jamais supprimée, ses réponses restent lisibles — et
//                le sceau n'est pas réécrit. Réécrire `sealHash` invaliderait
//                la vérification d'un document pourtant authentique.
//
// Dans les deux cas : MOTIF obligatoire, audit TOUJOURS écrit (y compris pour
// un historique anonyme sans `userId`) et notification jamais silencieuse — le
// titulaire s'il existe, sinon les administrateurs.
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { createNotification, notifyAllAdmins } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';
import { handleApiError } from '@/lib/error-handler';
import {
  LIFECYCLE_AUDIT_ACTIONS,
  notificationAudience,
  parseLifecycleReason,
  retrogradePlan,
  revokePlan,
} from '@/lib/attestations/lifecycle';

const SUPPORTED_ACTIONS = ['REVOKE', 'RETROGRADE'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

function isSupportedAction(action: unknown): action is SupportedAction {
  return SUPPORTED_ACTIONS.includes(action as SupportedAction);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminUser = await getAdminUser(request);

  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // #321 — étiquette d'action déclarée hors du `try` : le handler d'erreur a
  // besoin de savoir QUELLE action a échoué pour le diagnostic Sentry.
  let actionLabel = 'inconnue';

  try {
    const { action, reason } = await request.json();
    actionLabel = typeof action === 'string' ? action : 'inconnue';

    // Motif obligatoire : il est la justification de l'action et il est écrit
    // dans l'audit. Aucune action n'est exécutée sans lui.
    const parsed = parseLifecycleReason(reason);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message, code: 'MOTIF_REQUIS' }, { status: 400 });
    }

    if (!isSupportedAction(action)) {
      return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
    }

    // Récupérer l'attestation actuelle avec les infos utilisateur
    const attestation = await prisma.attestation.findUnique({
      where: { id },
      include: {
        formation: true,
      }
    });

    if (!attestation) {
      return NextResponse.json({ error: 'Attestation non trouvée' }, { status: 404 });
    }

    // Une ligne supprimée logiquement est figée : ni révocation ni
    // rétrogradation ne peuvent la modifier après coup.
    if (attestation.deletedAt) {
      return NextResponse.json(
        {
          error: 'Attestation supprimée logiquement : action impossible.',
          code: 'ATTESTATION_ALREADY_SOFT_DELETED',
        },
        { status: 409 },
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
    const actorId = adminUser.id ?? null;
    const formationName = attestation.formation?.name ?? "la formation";
    const audience = notificationAudience(attestation);

    if (action === 'REVOKE') {
      const plan = revokePlan(attestation, { reason: parsed.reason, actorId, now: new Date() });
      const updated = await prisma.attestation.update({
        where: { id },
        data: plan.data as Prisma.AttestationUncheckedUpdateInput,
      });

      // Audit : TOUJOURS, y compris pour une attestation anonyme (#301).
      await createAuditLog({
        userId: adminUser?.id || "",
        action: LIFECYCLE_AUDIT_ACTIONS.REVOKE,
        resource: 'ATTESTATION',
        resourceId: id,
        oldValue: { status: attestation.status },
        newValue: {
          adminId: adminUser?.id,
          reason: parsed.reason,
          status: 'REVOKED',
          destructive: false,
          previousStatus: attestation.status,
        },
        ipAddress,
      });

      // Notification : titulaire connu, sinon administrateurs.
      if (audience.kind === 'user') {
        await createNotification({
          userId: audience.userId,
          type: 'ATTESTATION_REJECTED',
          title: 'Attestation Révoquée ❌',
          message: `Votre attestation pour "${formationName}" a été annulée par l'administration. Motif : ${parsed.reason}`,
          link: '/results',
        });
      } else {
        await notifyAllAdmins({
          type: 'ATTESTATION_REJECTED',
          title: 'Attestation historique révoquée',
          message: `L'attestation ${attestation.code} (${attestation.fullName}, ${formationName}) a été révoquée. Aucun compte candidat associé — suivi requis. Motif : ${parsed.reason}`,
          link: `/admin/attestations/${id}`,
        });
      }

      return NextResponse.json({ message: 'Attestation révoquée', attestation: updated });
    }

    // RETROGRADE — la session probante est ARCHIVÉE, jamais supprimée.
    const plan = retrogradePlan(attestation, { reason: parsed.reason, actorId, now: new Date() });

    if (plan.sessionArchive) {
      await prisma.examSession.updateMany({
        where: plan.sessionArchive.where as Prisma.ExamSessionWhereInput,
        data: plan.sessionArchive.data as Prisma.ExamSessionUncheckedUpdateInput,
      });
    }

    const updated = await prisma.attestation.update({
      where: { id },
      data: plan.attestation as Prisma.AttestationUncheckedUpdateInput,
    });

    // Audit : TOUJOURS (ressource ATTESTATION, y compris sans userId) — l'ancien
    // journal n'était écrit que dans la branche `if (userId)`.
    await createAuditLog({
      userId: adminUser?.id || "",
      action: LIFECYCLE_AUDIT_ACTIONS.RETROGRADE,
      resource: 'ATTESTATION',
      resourceId: id,
      oldValue: { status: attestation.status },
      newValue: {
        adminId: adminUser?.id,
        action: 'RESET_EXAM_STATUS',
        reason: parsed.reason,
        destructive: false,
        sessionsArchived: plan.sessionArchive ? 1 : 0,
      },
      ipAddress,
    });

    if (audience.kind === 'user') {
      await createNotification({
        userId: audience.userId,
        type: 'GENERAL',
        title: 'Examen à repasser 🔄',
        message: `Votre évaluation pour "${formationName}" a été réinitialisée. Vous devez repasser l'examen. Motif : ${parsed.reason}`,
        link: '/exams',
      });
    } else {
      await notifyAllAdmins({
        type: 'GENERAL',
        title: 'Rétrogradation sans compte candidat',
        message: `L'attestation ${attestation.code} (${attestation.fullName}, ${formationName}) a été rétrogradée et ses sessions archivées. Aucun compte candidat associé — suivi requis. Motif : ${parsed.reason}`,
        link: `/admin/attestations/${id}`,
      });
    }

    return NextResponse.json({ message: 'Candidat rétrogradé avec succès', attestation: updated });

  } catch (error: unknown) {
    // #321 — le message brut n'est PLUS renvoyé au client. Un message Prisma
    //        expose des noms de tables, des colonnes, des contraintes et
    //        parfois des valeurs. `handleApiError` journalise le détail complet
    //        (message + stack) côté serveur, le remonte à Sentry, et ne laisse
    //        le message lisible qu'en développement — en production le client
    //        reçoit un message générique. Les erreurs MÉTIER ne passent pas
    //        par ici : elles sont renvoyées explicitement plus haut.
    return handleApiError(error, {
      route: '/api/admin/attestations/[id]/actions',
      operation: `lifecycle:${actionLabel}`,
      userId: adminUser.id ?? undefined,
    });
  }
}
