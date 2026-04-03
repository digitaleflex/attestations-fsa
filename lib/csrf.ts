// lib/csrf.ts
// Gestion des tokens CSRF - Protection contre les attaques cross-site request forgery
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

/**
 * Génère un token CSRF cryptographiquement sûr
 * @returns Token hexadécimal de 64 caractères
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Valide un token CSRF
 * @param token - Token à valider
 * @returns true si le token est valide (format hex 64 caractères)
 */
export function validateCSRFToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token)
}

/**
 * Ajoute un token CSRF aux cookies de la réponse
 * @param response - Response Next.js à modifier
 * @returns Response avec le cookie CSRF ajouté
 */
export async function addCSRFTokenToResponse(response: NextResponse): Promise<NextResponse> {
  const token = generateCSRFToken()
  
  response.cookies.set('csrf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24,  // 1 jour
  })
  
  return response
}

/**
 * Récupère le token CSRF depuis les cookies
 * @returns Token CSRF ou undefined
 */
export async function getCSRFToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('csrf_token')?.value
}

/**
 * Vérifie la validité d'un token CSRF
 * @param request - Requête contenant le token
 * @returns true si le token est valide
 */
export async function validateCSRF(request: Request): Promise<boolean> {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('csrf_token')?.value
  const headerToken = request.headers.get('x-csrf-token')
  
  if (!cookieToken || !headerToken) {
    return false
  }
  
  if (!validateCSRFToken(cookieToken) || !validateCSRFToken(headerToken)) {
    return false
  }
  
  return cookieToken === headerToken
}

/**
 * Middleware helper pour la validation CSRF
 * À utiliser dans les routes API protégées
 */
export async function requireCSRF(request: Request): Promise<{
  valid: boolean
  response?: NextResponse
}> {
  const isValid = await validateCSRF(request)
  
  if (!isValid) {
    return {
      valid: false,
      response: NextResponse.json(
        { 
          error: 'Token CSRF invalide ou manquant',
          code: 'CSRF_VALIDATION_FAILED'
        },
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }
  
  return { valid: true }
}

/**
 * Génère un nouveau token et invalide l'ancien
 * À utiliser après une connexion ou un changement de privilèges
 */
export async function rotateCSRFToken(): Promise<string> {
  const newToken = generateCSRFToken()
  const cookieStore = await cookies()
  
  cookieStore.set('csrf_token', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  
  return newToken
}

/**
 * Interface pour les formulaires sécurisés
 */
export interface SecureFormData {
  _csrf: string  // Token CSRF à inclure dans les formulaires
  [key: string]: any
}
