// app/api/user/password-reset/confirm/route.ts
// Confirmation de réinitialisation de mot de passe
// Valide le token et met à jour le mot de passe
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { handleApiError, ApiErrorImpl, ErrorTypes } from '@/lib/error-handler'
import { sanitizeInput } from '@/lib/sanitization'

// Schéma de validation avec politique de mot de passe forte
const ConfirmSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  email: z.string().email('Email invalide'),
  newPassword: z.string()
    .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
    .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères')
    .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Doit contenir au moins une minuscule')
    .regex(/[0-9]/, 'Doit contenir au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Doit contenir au moins un caractère spécial'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parse = ConfirmSchema.safeParse(body)
    
    if (!parse.success) {
      throw new ApiErrorImpl('VALIDATION', 'Données invalides', {
        details: parse.error.errors
      })
    }

    const { token, email, newPassword } = parse.data
    
    // Sanitization
    const sanitizedEmail = sanitizeInput(email)
    const sanitizedToken = sanitizeInput(token)

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({ 
      where: { email: sanitizedEmail },
      select: { id: true, email: true, name: true }
    })
    
    if (!user) {
      throw new ApiErrorImpl('NOT_FOUND', 'Token invalide ou expiré')
    }

    // Vérifier le token
    const verification = await prisma.verification.findFirst({
      where: {
        identifier: `password_reset:${user.id}`,
        value: sanitizedToken,
        expiresAt: { gt: new Date() },  // Token non expiré
      }
    })

    if (!verification) {
      throw new ApiErrorImpl('FORBIDDEN', 'Token invalide ou expiré')
    }

    // Hasher le nouveau mot de passe avec bcrypt cost 12
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        updatedAt: new Date()
      }
    })

    // Supprimer le token (usage unique)
    await prisma.verification.delete({ 
      where: { id: verification.id } 
    })

    // ✅ Invalider toutes les sessions existantes pour sécurité
    await prisma.session.deleteMany({ 
      where: { userId: user.id } 
    })

    // Logger l'événement (à implémenter avec security-logger)
    console.log(`[SECURITY] Password reset successful for user: ${user.email}`)

    return NextResponse.json({ 
      message: 'Mot de passe réinitialisé avec succès. Veuillez vous reconnecter.',
      success: true
    })

  } catch (error: any) {
    console.error('Password reset confirm error:', error)
    return handleApiError(error, {
      route: '/api/user/password-reset/confirm',
      operation: 'password_reset_confirm',
    })
  }
}

// GET - Vérifier la validité d'un token (optionnel, pour UX)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const email = searchParams.get('email')

    if (!token || !email) {
      return NextResponse.json(
        { valid: false, message: 'Token ou email manquant' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ 
      where: { email } 
    })

    if (!user) {
      return NextResponse.json(
        { valid: false, message: 'Token invalide' },
        { status: 400 }
      )
    }

    const verification = await prisma.verification.findFirst({
      where: {
        identifier: `password_reset:${user.id}`,
        value: token,
        expiresAt: { gt: new Date() },
      }
    })

    if (!verification) {
      return NextResponse.json(
        { valid: false, message: 'Token expiré ou invalide' },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      valid: true, 
      message: 'Token valide',
      email: user.email
    })

  } catch (error: any) {
    console.error('Token verification error:', error)
    return NextResponse.json(
      { valid: false, message: 'Erreur lors de la vérification' },
      { status: 500 }
    )
  }
}
