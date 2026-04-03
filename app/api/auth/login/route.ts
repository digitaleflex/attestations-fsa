// app/api/auth/login/route.ts
// Route de connexion avec rate limiting et sécurité renforcée
// ⚠️ NOTE: Cette route est un fallback - Better Auth (/api/auth/[...all]) est recommandé
// ✅ FIX: Standardisation du format de réponse d'erreur
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { applyRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/error-handler'
import { sanitizeInput } from '@/lib/sanitization'

// Schéma de validation pour la connexion
const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
})

export async function POST(request: Request) {
  try {
    // ✅ RATE LIMITING - 5 essais maximum par 15 minutes
    const rateLimit = await applyRateLimit(request as any, 'login')
    if (!rateLimit.allowed && rateLimit.response) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      console.warn(`[SECURITY] Rate limit exceeded for login from IP: ${ip}`)
      return rateLimit.response
    }

    const body = await request.json()
    const parse = LoginSchema.safeParse(body)

    if (!parse.success) {
      return NextResponse.json({
        error: 'Entrée invalide',
        details: parse.error.errors
      }, { status: 400 })
    }

    const { email, password } = parse.data

    // Sanitization
    const sanitizedEmail = sanitizeInput(email)

    // Vérifier la connexion à la base de données
    await prisma.$connect()

    // Chercher d'abord dans Admin, puis dans User
    let user: any = await prisma.admin.findUnique({ where: { email: sanitizedEmail } })
    let userType = 'ADMIN'

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: sanitizedEmail } })
      userType = 'USER'
    }

    // ⚠️ Message générique pour ne pas révéler si l'email existe
    if (!user) {
      return NextResponse.json({
        error: 'Email ou mot de passe incorrect'
      }, { status: 401 })
    }

    // Vérifier le mot de passe
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      // Logger l'échec de connexion (pour détection brute-force)
      console.warn(`[SECURITY] Échec de connexion pour: ${sanitizedEmail}`)
      return NextResponse.json({
        error: 'Email ou mot de passe incorrect'
      }, { status: 401 })
    }

    // ✅ Succès - Création du cookie de session
    // ⚠️ NOTE: Ces cookies custom devraient être remplacés par Better Auth
    const response = NextResponse.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: userType
      }
    })

    // Configuration des cookies avec flags de sécurité
    response.cookies.set('admin_session', user.id, {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 7 jours
    })

    response.cookies.set('user_role', userType, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7
    })

    // Logger la connexion réussie
    console.log(`[AUTH] Connexion réussie pour: ${sanitizedEmail} (${userType})`)

    return response

  } catch (error: any) {
    console.error('Erreur détaillée login:', error)
    return handleApiError(error, {
      route: '/api/auth/login',
      operation: 'login',
      ip: request.headers.get('x-forwarded-for') || undefined,
    })
  } finally {
    await prisma.$disconnect()
  }
}
