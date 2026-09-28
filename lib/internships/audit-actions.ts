/**
 * #267 — Actions d'audit des demandes de stage.
 *
 * Module sans dépendance (ni Prisma, ni Next) pour être importable par les
 * routes ET par les tests sans effet de bord.
 *
 * NOTE (#267) : le union type `AuditAction` de `lib/audit.ts` n'a volontairement
 * pas été étendu ici — `lib/audit.ts` est hors périmètre de ce ticket. Les
 * valeurs ci-dessous sont donc typées via un cast contrôlé, comme le fait déjà
 * `app/api/admin/internships/[id]/attestation/route.ts`. Elles sont stables et
 * directement exploitables par l'écran `/admin/audit`.
 */

import type { AuditAction } from "@/lib/audit";

/** Changement de statut : acceptation, refus, archivage, mise en examen. */
export const INTERNSHIP_STATUS_AUDIT_ACTIONS = {
  ACCEPTED: "INTERNSHIP_ACCEPTED",
  REJECTED: "INTERNSHIP_REJECTED",
  ARCHIVED: "INTERNSHIP_ARCHIVED",
  REVIEWING: "INTERNSHIP_STATUS_UPDATED",
  PENDING: "INTERNSHIP_STATUS_UPDATED",
} as const;

/** Statut cible inconnu (donnée legacy) : on retombe sur un libellé générique. */
const INTERNSHIP_STATUS_AUDIT_ACTION_FALLBACK = "INTERNSHIP_STATUS_UPDATED";

/** Export Excel des demandes de stage. */
export const INTERNSHIP_EXPORT_AUDIT_ACTION = "INTERNSHIP_EXPORTED";

export const INTERNSHIP_AUDIT_RESOURCE = "INTERNSHIP_REQUEST";

/** Cast unique, centralisé : les valeurs ci-dessus ne sont pas encore dans l'union. */
export function asAuditAction(value: string): AuditAction {
  return value as AuditAction;
}

/** Action d'audit correspondant à un statut cible. */
export function auditActionForInternshipStatus(
  status: string,
): AuditAction {
  const known = (INTERNSHIP_STATUS_AUDIT_ACTIONS as Record<string, string | undefined>)[
    status
  ];
  return asAuditAction(known ?? INTERNSHIP_STATUS_AUDIT_ACTION_FALLBACK);
}
