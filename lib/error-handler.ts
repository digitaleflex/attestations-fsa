// lib/error-handler.ts
// Gestion centralisée et sécurisée des erreurs API
// Masque les détails sensibles en production
import { NextResponse } from 'next/server'

interface ApiError {
  message: string
  code?: string
  details?: any
}

interface ErrorContext {
  route?: string
  userId?: string
  operation?: string
  ip?: string
}

/**
 * Types d'erreurs connues avec codes HTTP associés
 */
export const ErrorTypes = {
  VALIDATION: { code: 'VALIDATION_ERROR', status: 400 },
  NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403 },
  CONFLICT: { code: 'CONFLICT', status: 409 },
  RATE_LIMIT: { code: 'RATE_LIMIT_EXCEEDED', status: 429 },
  CSRF: { code: 'CSRF_VALIDATION_FAILED', status: 403 },
  SERVER: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
} as const

/**
 * Crée un objet d'erreur standardisé
 */
export function createError(
  type: keyof typeof ErrorTypes,
  message: string,
  details?: any
): ApiError {
  return {
    message,
    code: ErrorTypes[type].code,
    details,
  }
}

/**
 * Message d'erreur générique pour le public
 */
const PUBLIC_ERROR_MESSAGE = 'Une erreur est survenue. Veuillez réessayer plus tard.'

/**
 * Gère les erreurs de manière sécurisée
 * - Log les détails complets côté serveur
 * - Masque les informations sensibles en production
 * - Retourne un format d'erreur cohérent
 */
export function handleApiError(
  error: unknown,
  context?: ErrorContext
): NextResponse {
  // Logger l'erreur complète (côté serveur uniquement)
  const errorDetails = {
    timestamp: new Date().toISOString(),
    route: context?.route,
    operation: context?.operation,
    userId: context?.userId,
    ip: context?.ip,
    error: {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    },
  }

  console.error('[API ERROR]', JSON.stringify(errorDetails, null, 2))

  // En développement, afficher plus de détails
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : PUBLIC_ERROR_MESSAGE,
        code: error instanceof Error && 'code' in error ? (error as any).code : undefined,
        details: error instanceof Error ? error.stack : undefined,
        context: process.env.NODE_ENV === 'development' ? context : undefined,
      },
      { status: 500 }
    )
  }

  // En production, message générique uniquement
  // Sauf pour les erreurs métier connues
  if (error instanceof ApiErrorImpl) {
    return NextResponse.json(
      {
        message: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.status }
    )
  }

  return NextResponse.json(
    {
      message: PUBLIC_ERROR_MESSAGE,
      code: 'INTERNAL_SERVER_ERROR',
    },
    { status: 500 }
  )
}

/**
 * Classe d'erreur API personnalisée
 * Permet de lever des erreurs métier avec statut HTTP
 */
export class ApiErrorImpl extends Error {
  code: string
  status: number
  details?: any

  constructor(
    type: keyof typeof ErrorTypes,
    message: string,
    details?: any
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = ErrorTypes[type].code
    this.status = ErrorTypes[type].status
    this.details = details
  }
}

/**
 * Wrapper pour exécuter du code et gérer les erreurs automatiquement
 * Usage: await withErrorHandler(async () => { ... }, request)
 */
export async function withErrorHandler<T>(
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<NextResponse | T> {
  try {
    const result = await fn()
    return result
  } catch (error) {
    return handleApiError(error, context)
  }
}

/**
 * Formatte une erreur de validation Zod
 */
export function formatValidationError(error: any): ApiError {
  if (error?.errors) {
    return {
      message: 'Validation échouée',
      code: 'VALIDATION_ERROR',
      details: error.errors.map((e: any) => ({
        field: e.path?.join('.') || 'unknown',
        message: e.message,
      })),
    }
  }

  return {
    message: 'Entrée invalide',
    code: 'VALIDATION_ERROR',
  }
}

/**
 * Middleware de gestion d'erreur pour les routes API
 * Usage: export const POST = async (req) => handleApiRoute(async () => { ... })
 */
export function handleApiRoute<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return ((...args: any[]) =>
    withErrorHandler(
      () => handler(...args),
      {
        route: args[0]?.url,
        operation: 'API_HANDLER',
      }
    )) as T
}
