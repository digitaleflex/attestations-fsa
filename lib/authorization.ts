// lib/authorization.ts
// Protection contre les attaques IDOR (Insecure Direct Object Reference)
// Vérification systématique de l'appartenance des ressources
import { prisma } from '@/lib/prisma'

/**
 * Vérifie l'appartenance (ownership) d'une ressource
 * @param resource - La ressource à vérifier
 * @param userId - ID de l'utilisateur connecté
 * @param resourceType - Type de ressource (pour logging)
 * @returns true si l'utilisateur possède la ressource
 */
export async function checkOwnership<T extends { userId: string | null }>(
  resource: T | null,
  userId: string,
  resourceType: string
): Promise<boolean> {
  if (!resource) {
    return false
  }

  // Admin a accès à tout
  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    select: { role: true }
  })
  
  if (user?.role === 'ADMIN') {
    return true
  }

  // Vérifier ownership
  if (resource.userId !== userId) {
    console.warn(
      `[IDOR] Tentative d'accès non autorisé à ${resourceType}: ${resource.id} par user ${userId}`
    )
    return false
  }

  return true
}

/**
 * Helper pour créer un vérificateur d'appartenance
 * Usage: const checkSubmission = createOwnershipChecker(prisma.examSubmission, userId, isAdmin)
 *        const result = await checkSubmission(submissionId)
 */
export function createOwnershipChecker(
  model: any,
  userId: string,
  isAdmin: boolean
) {
  return async (resourceId: string) => {
    const resource = await model.findUnique({
      where: { id: resourceId },
      select: { userId: true }
    })

    if (!resource) {
      return { found: false, authorized: false }
    }

    // Admin a accès à tout
    if (isAdmin) {
      return { found: true, authorized: true }
    }

    // Vérifier ownership
    if (resource.userId !== userId) {
      return { found: true, authorized: false }
    }

    return { found: true, authorized: true }
  }
}

/**
 * Middleware pour vérifier l'accès à une ressource
 * À utiliser dans les routes API
 * 
 * @example
 * const result = await requireOwnership(
 *   prisma.examSubmission,
 *   submissionId,
 *   userId,
 *   isAdmin
 * )
 * if (!result.authorized) {
 *   return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
 * }
 */
export async function requireOwnership(
  model: any,
  resourceId: string,
  userId: string,
  isAdmin: boolean,
  resourceType?: string
): Promise<{ found: boolean; authorized: boolean; resource?: any }> {
  const resource = await model.findUnique({
    where: { id: resourceId },
  })

  if (!resource) {
    return { found: false, authorized: false }
  }

  // Admin a accès à tout
  if (isAdmin) {
    return { found: true, authorized: true, resource }
  }

  // Vérifier ownership
  if (resource.userId !== userId) {
    console.warn(
      `[IDOR] Tentative d'accès non autorisé: ${resourceType || 'resource'} ${resourceId}`
    )
    return { found: true, authorized: false }
  }

  return { found: true, authorized: true, resource }
}

/**
 * Vérifie qu'un utilisateur a un rôle spécifique
 */
export async function requireRole(
  userId: string,
  requiredRole: 'ADMIN' | 'USER'
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })

  return user?.role === requiredRole
}

/**
 * Vérifie qu'un utilisateur est admin
 */
export async function requireAdmin(userId: string): Promise<boolean> {
  return requireRole(userId, 'ADMIN')
}

/**
 * Vérifie l'accès à une ressource avec permission personnalisée
 * @param model - Modèle Prisma
 * @param resourceId - ID de la ressource
 * @param permissionFn - Fonction de vérification de permission
 */
export async function checkPermission(
  model: any,
  resourceId: string,
  permissionFn: (resource: any) => boolean | Promise<boolean>
): Promise<{ allowed: boolean; resource?: any }> {
  const resource = await model.findUnique({
    where: { id: resourceId },
  })

  if (!resource) {
    return { allowed: false }
  }

  const allowed = await permissionFn(resource)
  return { allowed, resource }
}

/**
 * Types de ressources avec leurs vérificateurs
 */
export const ResourceGuards = {
  /**
   * Vérifie l'accès à une soumission d'examen
   */
  examSubmission: async (submissionId: string, userId: string, isAdmin: boolean) => {
    return requireOwnership(
      prisma.examSubmission,
      submissionId,
      userId,
      isAdmin,
      'examSubmission'
    )
  },

  /**
   * Vérifie l'accès à une attestation
   */
  attestation: async (attestationId: string, userId: string, isAdmin: boolean) => {
    return requireOwnership(
      prisma.attestation,
      attestationId,
      userId,
      isAdmin,
      'attestation'
    )
  },

  /**
   * Vérifie l'accès à une demande de correction
   */
  correctionRequest: async (requestId: string, userId: string, isAdmin: boolean) => {
    return requireOwnership(
      prisma.correctionRequest,
      requestId,
      userId,
      isAdmin,
      'correctionRequest'
    )
  },

  /**
   * Vérifie l'accès à une demande de stage
   */
  internshipRequest: async (requestId: string, userId: string, isAdmin: boolean) => {
    // Les internship requests peuvent être publiques ou privées
    const request = await prisma.internshipRequest.findUnique({
      where: { id: requestId },
      select: { userId: true }
    })

    if (!request) {
      return { found: false, authorized: false }
    }

    if (isAdmin) {
      return { found: true, authorized: true }
    }

    // Seul le propriétaire peut voir sa demande
    if (request.userId !== userId) {
      return { found: true, authorized: false }
    }

    return { found: true, authorized: true }
  },
}

/**
 * Helper pour les requêtes avec filtrage par utilisateur
 * Retourne un objet Where pour Prisma
 */
export function createUserFilter(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return {}  // Admin voit tout
  }
  return { userId }  // User ne voit que ses ressources
}

/**
 * Wrapper pour les opérations CRUD avec vérification IDOR
 */
export class SecureResource<T> {
  constructor(
    private model: any,
    private userId: string,
    private isAdmin: boolean
  ) {}

  /**
   * Récupère une ressource avec vérification d'ownership
   */
  async find(id: string): Promise<T | null> {
    const result = await requireOwnership(
      this.model,
      id,
      this.userId,
      this.isAdmin
    )
    return result.resource || null
  }

  /**
   * Récupère plusieurs ressources avec filtrage automatique
   */
  async findMany(params?: any): Promise<T[]> {
    const where = {
      ...params?.where,
      ...createUserFilter(this.userId, this.isAdmin),
    }
    return this.model.findMany({ ...params, where })
  }

  /**
   * Crée une ressource avec attribution automatique à l'utilisateur
   */
  async create(data: any): Promise<T> {
    return this.model.create({
      data: {
        ...data,
        userId: this.userId,
      },
    })
  }

  /**
   * Met à jour une ressource avec vérification d'ownership
   */
  async update(id: string, data: any): Promise<T> {
    const result = await requireOwnership(
      this.model,
      id,
      this.userId,
      this.isAdmin
    )
    
    if (!result.authorized) {
      throw new Error('Accès non autorisé')
    }

    return this.model.update({
      where: { id },
      data,
    })
  }

  /**
   * Supprime une ressource avec vérification d'ownership
   */
  async delete(id: string): Promise<T> {
    const result = await requireOwnership(
      this.model,
      id,
      this.userId,
      this.isAdmin
    )
    
    if (!result.authorized) {
      throw new Error('Accès non autorisé')
    }

    return this.model.delete({
      where: { id },
    })
  }
}

/**
 * Factory pour créer un SecureResource
 */
export function createSecureResource<T>(
  model: any,
  userId: string,
  isAdmin: boolean
): SecureResource<T> {
  return new SecureResource<T>(model, userId, isAdmin)
}
