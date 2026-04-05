// app/api/user/send-verification/route.ts
// Envoi d'un email de vérification d'adresse email
// Token unique avec expiration 24h
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { handleApiError, ApiErrorImpl } from '@/lib/error-handler'
import { applyRateLimit } from '@/lib/rate-limit'
import { getAuth } from '@/lib/auth'
import { emailService } from '@/lib/email'

export async function POST(request: Request) {
  try {
    // ✅ Rate limiting - 5 envois par heure
    const rateLimit = await applyRateLimit(request, 'emailVerification')
    if (!rateLimit.allowed && rateLimit.response) {
      return rateLimit.response
    }

    // Vérifier l'authentification
    const auth = await getAuth()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      throw new ApiErrorImpl('UNAUTHORIZED', 'Non autorisé - Authentification requise')
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true
      }
    })

    if (!user) {
      throw new ApiErrorImpl('NOT_FOUND', 'Utilisateur non trouvé')
    }

    // Vérifier si l'email est déjà vérifié
    if (user.emailVerified) {
      throw new ApiErrorImpl('CONFLICT', 'Email déjà vérifié')
    }

    // Générer un token unique
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24 heures

    // Supprimer les anciens tokens de vérification
    await prisma.verification.deleteMany({
      where: {
        identifier: { startsWith: 'email_verify:' },
        value: { startsWith: user.id }
      }
    })

    // Stocker le token
    await prisma.verification.create({
      data: {
        identifier: `email_verify:${user.id}`,
        value: token,
        expiresAt,
      }
    })

    // Générer le lien de vérification
    const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/verify-email?token=${token}`

    // Envoyer l'email via le service centralisé
    await emailService.sendVerificationEmail(
      user.email!,
      user.name || 'Candidat',
      verifyLink
    )

    return NextResponse.json({
      message: 'Email de vérification envoyé avec succès',
      success: true
    })

  } catch (error: unknown) {
    console.error('Send verification error:', error)
    return handleApiError(error instanceof Error ? error : new Error(String(error)), {
      route: '/api/user/send-verification',
      operation: 'send_verification',
    })
  }
}
