// lib/security-logger.ts
// Journalisation des événements de sécurité
// Pour détection d'attaques et audit de sécurité
import { prisma } from '@/lib/prisma'

// Types d'événements de sécurité
export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_CONFIRM'
  | 'EMAIL_VERIFICATION'
  | 'ACCESS_DENIED'
  | 'RESOURCE_CREATE'
  | 'RESOURCE_UPDATE'
  | 'RESOURCE_DELETE'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'DATA_EXPORT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_VIOLATION'
  | 'SUSPICIOUS_ACTIVITY'
  | 'BRUTE_FORCE_DETECTED'
  | 'INVALID_INPUT'
  | 'PRIVILEGE_ESCALATION_ATTEMPT'

// Niveau de sévérité
export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

// Interface d'un événement de sécurité
export interface SecurityEvent {
  eventType: SecurityEventType
  userId?: string
  userEmail?: string
  ipAddress?: string
  userAgent?: string
  resource?: string
  resourceId?: string
  action?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED'
  details?: Record<string, unknown>
  severity?: SecuritySeverity
  timestamp?: Date
}

// Mapping des sévérités par défaut
const DEFAULT_SEVERITY: Record<SecurityEventType, SecuritySeverity> = {
  LOGIN_SUCCESS: 'LOW',
  LOGIN_FAILURE: 'MEDIUM',
  LOGOUT: 'LOW',
  PASSWORD_CHANGE: 'HIGH',
  PASSWORD_RESET_REQUEST: 'HIGH',
  PASSWORD_RESET_CONFIRM: 'CRITICAL',
  EMAIL_VERIFICATION: 'MEDIUM',
  ACCESS_DENIED: 'MEDIUM',
  RESOURCE_CREATE: 'MEDIUM',
  RESOURCE_UPDATE: 'MEDIUM',
  RESOURCE_DELETE: 'HIGH',
  FILE_UPLOAD: 'MEDIUM',
  FILE_DOWNLOAD: 'LOW',
  DATA_EXPORT: 'HIGH',
  RATE_LIMIT_EXCEEDED: 'MEDIUM',
  CSRF_VIOLATION: 'CRITICAL',
  SUSPICIOUS_ACTIVITY: 'HIGH',
  BRUTE_FORCE_DETECTED: 'CRITICAL',
  INVALID_INPUT: 'LOW',
  PRIVILEGE_ESCALATION_ATTEMPT: 'CRITICAL',
}

/**
 * Log un événement de sécurité
 * @param event - Événement à logger
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  const severity = event.severity || DEFAULT_SEVERITY[event.eventType]
  const timestamp = event.timestamp || new Date()

  // Logger en console (pour développement et monitoring temps réel)
  const logEntry = {
    timestamp: timestamp.toISOString(),
    level: severity,
    event: event.eventType,
    userId: event.userId,
    userEmail: event.userEmail,
    ipAddress: event.ipAddress,
    resource: event.resource,
    status: event.status,
    details: event.details ? JSON.stringify(event.details) : undefined,
  }

  console.log(`[SECURITY] ${event.eventType}`, logEntry)

  // Stocker en base de données (pour audit et analyse forensique)
  try {
    await prisma.securityLog.create({
      data: {
        eventType: event.eventType,
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        resource: event.resource,
        resourceId: event.resourceId,
        action: event.action,
        status: event.status,
        severity,
        details: event.details || {},
        timestamp,
      },
    })
  } catch (error) {
    // En cas d'erreur de logging, on logge l'erreur mais on ne bloque pas
    console.error('[SECURITY LOG ERROR] Failed to store security event:', error)
  }
}

/**
 * Helper pour logger une tentative de connexion échouée
 */
export async function logLoginFailure(
  email: string,
  ipAddress?: string,
  userAgent?: string,
  reason?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'LOGIN_FAILURE',
    userEmail: email,
    ipAddress,
    userAgent,
    status: 'FAILURE',
    severity: 'MEDIUM',
    details: { reason },
  })
}

/**
 * Helper pour logger une tentative de connexion réussie
 */
export async function logLoginSuccess(
  userId: string,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'LOGIN_SUCCESS',
    userId,
    userEmail: email,
    ipAddress,
    userAgent,
    status: 'SUCCESS',
  })
}

/**
 * Helper pour logger un accès refusé
 */
export async function logAccessDenied(
  userId: string | undefined,
  resource: string,
  resourceId?: string,
  ipAddress?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'ACCESS_DENIED',
    userId,
    resource,
    resourceId,
    ipAddress,
    status: 'BLOCKED',
  })
}

/**
 * Helper pour logger une activité suspecte
 */
export async function logSuspiciousActivity(
  description: string,
  userId?: string,
  ipAddress?: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logSecurityEvent({
    eventType: 'SUSPICIOUS_ACTIVITY',
    userId,
    ipAddress,
    status: 'BLOCKED',
    severity: 'HIGH',
    details: { description, ...details },
  })
}

/**
 * Helper pour logger une violation CSRF
 */
export async function logCSRFViolation(
  userId: string | undefined,
  route: string,
  ipAddress?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'CSRF_VIOLATION',
    userId,
    resource: route,
    ipAddress,
    status: 'BLOCKED',
    severity: 'CRITICAL',
  })
}

/**
 * Helper pour logger un dépassement de rate limit
 */
export async function logRateLimitExceeded(
  limitType: string,
  ipAddress: string,
  userId?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'RATE_LIMIT_EXCEEDED',
    userId,
    ipAddress,
    status: 'BLOCKED',
    details: { limitType },
  })
}

/**
 * Helper pour logger un upload de fichier
 */
export async function logFileUpload(
  userId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  resourceId?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'FILE_UPLOAD',
    userId,
    resource: 'file',
    resourceId,
    status: 'SUCCESS',
    details: { fileName, fileSize, mimeType },
  })
}

/**
 * Récupère les événements de sécurité récents (pour admin)
 */
export async function getRecentSecurityEvents(
  limit: number = 100,
  severity?: SecuritySeverity,
  eventType?: SecurityEventType
): Promise<any[]> {
  const where: any = {}
  
  if (severity) {
    where.severity = severity
  }
  
  if (eventType) {
    where.eventType = eventType
  }

  return await prisma.securityLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit,
  })
}

/**
 * Nettoie les anciens logs (à exécuter périodiquement)
 * Garde les 90 derniers jours
 */
export async function cleanupOldSecurityLogs(daysToKeep: number = 90): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const result = await prisma.securityLog.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  })

  console.log(`[SECURITY] Cleaned up ${result.count} old security logs`)
}
