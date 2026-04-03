// lib/audit-logger.ts
// Journalisation des actions métier pour audit et traçabilité
// Différent du security-logger qui se concentre sur les événements de sécurité
import { prisma } from '@/lib/prisma'

// Types d'actions auditées
export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT' | 'VALIDATE' | 'REJECT'

// Ressources auditées
export type AuditResource =
  | 'USER'
  | 'ADMIN'
  | 'ATTESTATION'
  | 'EXAM'
  | 'EXAM_SUBMISSION'
  | 'INTERNSHIP_REQUEST'
  | 'CORRECTION_REQUEST'
  | 'SETTINGS'
  | 'FILE'
  | 'REPORT'

// Interface d'un log d'audit
export interface AuditLogEntry {
  userId: string
  action: AuditAction
  resource: AuditResource
  resourceId: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  details?: Record<string, unknown>
  timestamp?: Date
}

/**
 * Log une action d'audit
 * @param log - Entrée d'audit à logger
 */
export async function logAuditEvent(log: AuditLogEntry): Promise<void> {
  const timestamp = log.timestamp || new Date()

  // Logger en console
  console.log(`[AUDIT] ${log.action} ${log.resource}`, {
    userId: log.userId,
    resourceId: log.resourceId,
    timestamp: timestamp.toISOString(),
    ipAddress: log.ipAddress,
  })

  // Stocker en base de données
  try {
    await prisma.auditLog.create({
      data: {
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        oldValue: log.oldValue || {},
        newValue: log.newValue || {},
        ipAddress: log.ipAddress,
        timestamp,
      },
    })
  } catch (error) {
    console.error('[AUDIT LOG ERROR] Failed to store audit event:', error)
  }
}

/**
 * Helper pour logger la création d'une ressource
 */
export async function logCreate(
  userId: string,
  resource: AuditResource,
  resourceId: string,
  data: Record<string, unknown>,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'CREATE',
    resource,
    resourceId,
    newValue: data,
    ipAddress,
  })
}

/**
 * Helper pour logger la modification d'une ressource
 */
export async function logUpdate(
  userId: string,
  resource: AuditResource,
  resourceId: string,
  oldValue: Record<string, unknown>,
  newValue: Record<string, unknown>,
  ipAddress?: string
): Promise<void> {
  // Ne logger que les champs qui ont changé
  const changes = getChangedFields(oldValue, newValue)
  
  if (Object.keys(changes).length > 0) {
    await logAuditEvent({
      userId,
      action: 'UPDATE',
      resource,
      resourceId,
      oldValue,
      newValue: changes,
      ipAddress,
      details: { changedFields: Object.keys(changes) },
    })
  }
}

/**
 * Helper pour logger la suppression d'une ressource
 */
export async function logDelete(
  userId: string,
  resource: AuditResource,
  resourceId: string,
  oldValue: Record<string, unknown>,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'DELETE',
    resource,
    resourceId,
    oldValue,
    ipAddress,
  })
}

/**
 * Helper pour logger la lecture d'une ressource sensible
 */
export async function logRead(
  userId: string,
  resource: AuditResource,
  resourceId: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'READ',
    resource,
    resourceId,
    ipAddress,
  })
}

/**
 * Helper pour logger une validation
 */
export async function logValidate(
  userId: string,
  resource: AuditResource,
  resourceId: string,
  details?: Record<string, unknown>,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'VALIDATE',
    resource,
    resourceId,
    ipAddress,
    details,
  })
}

/**
 * Helper pour logger un rejet
 */
export async function logReject(
  userId: string,
  resource: AuditResource,
  resourceId: string,
  reason?: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'REJECT',
    resource,
    resourceId,
    ipAddress,
    details: { reason },
  })
}

/**
 * Compare deux objets et retourne les champs changés
 */
export function getChangedFields(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {}
  
  const allKeys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ])
  
  for (const key of allKeys) {
    const oldValue = oldObj?.[key]
    const newValue = newObj?.[key]
    
    // Comparaison profonde pour JSON
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = {
        old: oldValue,
        new: newValue,
      }
    }
  }
  
  return changes
}

/**
 * Wrapper pour auditer automatiquement une opération CRUD
 */
export class AuditedResource {
  constructor(
    private resource: AuditResource,
    private userId: string,
    private ipAddress?: string
  ) {}

  /**
   * Crée une ressource avec audit automatique
   */
  async create(
    model: any,
    data: any,
    resourceId?: string
  ): Promise<any> {
    const result = await model.create({ data })
    
    await logCreate(
      this.userId,
      this.resource,
      resourceId || result.id,
      data,
      this.ipAddress
    )
    
    return result
  }

  /**
   * Met à jour une ressource avec audit automatique
   */
  async update(
    model: any,
    resourceId: string,
    data: any
  ): Promise<any> {
    // Récupérer l'ancienne valeur
    const oldValue = await model.findUnique({
      where: { id: resourceId },
    })
    
    const result = await model.update({
      where: { id: resourceId },
      data,
    })
    
    await logUpdate(
      this.userId,
      this.resource,
      resourceId,
      oldValue || {},
      result,
      this.ipAddress
    )
    
    return result
  }

  /**
   * Supprime une ressource avec audit automatique
   */
  async delete(
    model: any,
    resourceId: string
  ): Promise<any> {
    // Récupérer l'ancienne valeur
    const oldValue = await model.findUnique({
      where: { id: resourceId },
    })
    
    const result = await model.delete({
      where: { id: resourceId },
    })
    
    await logDelete(
      this.userId,
      this.resource,
      resourceId,
      oldValue || {},
      this.ipAddress
    )
    
    return result
  }
}

/**
 * Factory pour créer un AuditedResource
 */
export function createAuditedResource(
  resource: AuditResource,
  userId: string,
  ipAddress?: string
): AuditedResource {
  return new AuditedResource(resource, userId, ipAddress)
}

/**
 * Récupère les logs d'audit récents (pour admin)
 */
export async function getRecentAuditLogs(
  limit: number = 100,
  userId?: string,
  resource?: AuditResource,
  action?: AuditAction
): Promise<any[]> {
  const where: any = {}
  
  if (userId) {
    where.userId = userId
  }
  
  if (resource) {
    where.resource = resource
  }
  
  if (action) {
    where.action = action
  }

  return await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  })
}

/**
 * Nettoie les anciens logs d'audit (à exécuter périodiquement)
 * Garde les 365 derniers jours
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 365): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const result = await prisma.auditLog.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  })

  console.log(`[AUDIT] Cleaned up ${result.count} old audit logs`)
}
