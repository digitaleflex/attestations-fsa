import { prisma } from "./prisma";

export async function createAuditLog({
  userId,
  action,
  resource,
  resourceId,
  oldValue,
  newValue,
  ipAddress
}: {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
}) {
  try {
    return await prisma.auditLog.create({
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
    console.error("Failed to create audit log:", error);
  }
}
