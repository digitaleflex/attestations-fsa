/**
 * #267 — Service de mutation du statut d'une demande de stage.
 *
 * Utilisé par les deux points d'entrée admin (`PATCH /api/admin/internships` et
 * `PATCH /api/admin/internships/[id]`) pour garantir UN seul comportement :
 *   1. lecture de l'état courant (404 si la demande n'existe pas) ;
 *   2. validation de la valeur + de la transition (400 avant toute écriture) ;
 *   3. écriture ;
 *   4. audit systématique de la décision ;
 *   5. notification du candidat pour acceptation / refus.
 *
 * Le service ne construit jamais de réponse HTTP : il renvoie un résultat
 * discriminé, ce qui le rend testable sans Next.js.
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

import {
  INTERNSHIP_AUDIT_RESOURCE,
  INTERNSHIP_EXPORT_AUDIT_ACTION,
  asAuditAction,
  auditActionForInternshipStatus,
} from "./audit-actions";
import { validateInternshipStatusTransition } from "./state-machine";

export type InternshipStatusMutationFailure = {
  ok: false;
  status: 400 | 404;
  code: string;
  message: string;
};

export type InternshipStatusMutationResult =
  | {
      ok: true;
      /** Le statut demandé était déjà le statut courant : aucune écriture. */
      unchanged: boolean;
      previousStatus: string | null;
      status: string;
      /** La demande telle que renvoyée par Prisma après écriture. */
      request: Record<string, unknown> | null;
    }
  | InternshipStatusMutationFailure;

export async function applyInternshipStatusChange(input: {
  id: string;
  to: string;
  adminUser: { id?: string | null } | null;
  ipAddress?: string | null;
}): Promise<InternshipStatusMutationResult> {
  const { id, to, adminUser, ipAddress = null } = input;

  const current = await prisma.internshipRequest.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true, position: true },
  });

  if (!current) {
    return {
      ok: false,
      status: 404,
      code: "INTERNSHIP_REQUEST_NOT_FOUND",
      message: "Demande de stage non trouvée",
    };
  }

  // Matrice des transitions : une transition interdite est refusée AVANT
  // toute écriture. Un statut identique reste un no-op autorisé.
  const transition = validateInternshipStatusTransition({
    from: current.status,
    to,
  });
  if (!transition.ok) {
    return {
      ok: false,
      status: transition.status,
      code: transition.code,
      message: transition.message,
    };
  }

  if (current.status === to) {
    return {
      ok: true,
      unchanged: true,
      previousStatus: current.status,
      status: current.status,
      request: null,
    };
  }

  const updated = await prisma.internshipRequest.update({
    where: { id },
    data: { status: to as never },
  });

  // 🛡️ Audit : toute décision admin sur une demande de stage est tracée
  // (acceptation, refus, archivage, mise en examen).
  if (adminUser?.id) {
    await createAuditLog({
      userId: adminUser.id,
      action: auditActionForInternshipStatus(to),
      resource: INTERNSHIP_AUDIT_RESOURCE,
      resourceId: id,
      oldValue: { status: current.status },
      newValue: {
        status: to,
        previousStatus: current.status,
        adminId: adminUser.id,
      },
      ipAddress,
    });
  }

  // Notification du candidat (décisions qui le concernent directement).
  if (current.userId) {
    if (to === "ACCEPTED") {
      await createNotification({
        userId: current.userId,
        type: "INTERNSHIP_ACCEPTED",
        title: "Demande de stage acceptée ! 🎯",
        message: `Votre demande de stage pour le poste "${current.position}" a été acceptée.`,
        link: "/internships",
      });
    } else if (to === "REJECTED") {
      await createNotification({
        userId: current.userId,
        type: "INTERNSHIP_REJECTED",
        title: "Demande de stage rejetée",
        message: `Votre demande de stage pour le poste "${current.position}" a été rejetée. Contactez le support pour plus d'informations.`,
        link: "/internships",
      });
    }
  }

  return {
    ok: true,
    unchanged: false,
    previousStatus: current.status,
    status: to,
    request: updated as unknown as Record<string, unknown>,
  };
}

/** Journalise un export de demandes de stage (pagination + filtres inclus). */
export async function auditInternshipExport(input: {
  adminUser: { id?: string | null } | null;
  page: number;
  pageSize: number;
  total: number;
  status: string | null;
  ipAddress?: string | null;
}): Promise<void> {
  const { adminUser, page, pageSize, total, status, ipAddress = null } = input;
  if (!adminUser?.id) return;
  await createAuditLog({
    userId: adminUser.id,
    // L'export n'est pas un changement de statut : action dédiée.
    action: asAuditAction(INTERNSHIP_EXPORT_AUDIT_ACTION),
    resource: INTERNSHIP_AUDIT_RESOURCE,
    resourceId: `export-${new Date().toISOString().slice(0, 10)}`,
    newValue: { page, pageSize, total, status },
    ipAddress,
  });
}
