import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type AuditAction =
  | "GRADE_EXAM"
  | "UPDATE_GRADE"
  | "RECLAMATION_REPLY"
  | "DELETE_SUBMISSION"
  | "SETTINGS_CHANGE"
  | "SETTINGS_UPDATED"
  | "USER_MANAGEMENT"
  | "USER_PORTFOLIO_UPDATED"
  | "EXAM_SUBMITTED"
  | "EXAM_CREATED"
  | "EXAM_UPDATED"
  | "EXAM_DELETED"
  | "EXAM_STARTED"
  | "CORRECTION_APPROVED"
  | "CORRECTION_REJECTED"
  | "ATTESTATION_REVOKED"
  | "ATTESTATION_VALIDATED"
  | "ATTESTATION_UPDATED"
  | "ATTESTATION_DELETED"
  | "USER_RETROGRADED"
  | "BULK_ACTION"
  | "RESOURCE_CREATED"
  | "RESOURCE_UPDATED"
  | "RESOURCE_DELETED"
  | "INTERNSHIP_ATTESTATION_GENERATED"
  | "ACCOUNT_BLOCKED"
  | "ACCOUNT_UNBLOCKED"
  | "ADMIN_UPDATE_PROFILE";

/**
 * Enregistre une action administrative dans le journal d'audit
 */
export async function createAuditLog({
  userId,
  action,
  resource,
  resourceId,
  oldValue = null,
  newValue = null,
  ipAddress = null
}: {
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}, tx?: Prisma.TransactionClient) {
  try {
    const client = tx || prisma;
    return await client.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        ipAddress
      }
    });
  } catch (error) {
    console.error("[AUDIT_LOG_ERROR]", error);
  }
}
