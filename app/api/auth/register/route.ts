// app/api/auth/register/route.ts
// Route d'inscription candidat avec rate limiting et sécurité renforcée
// ✅ FIX: Ajout du rate limiting et sanitization
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { applyRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/error-handler'
import { sanitizeInput } from '@/lib/sanitization'
import { emailService } from '@/lib/email'
import { randomBytes } from 'crypto'

// Schéma de validation pour l'inscription candidat (formulaire public)
const RegisterSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins 1 majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins 1 minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins 1 chiffre')
    .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins 1 caractère spécial'),
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // ✅ RATE LIMITING - 3 inscriptions maximum par heure
    const rateLimit = await applyRateLimit(request, 'register')
    if (!rateLimit.allowed && rateLimit.response) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      console.warn(`[SECURITY] Rate limit exceeded for registration from IP: ${ip}`)
      return rateLimit.response
    }

    const body = await request.json()
    const parse = RegisterSchema.safeParse(body)
    if (!parse.success) {
      return NextResponse.json({
        error: 'Données invalides',
        details: parse.error.errors
      }, { status: 400 })
    }

    const { email, password, name, birthDate, birthPlace, phone, address } = parse.data

    // ✅ SANITIZATION
    const sanitizedEmail = sanitizeInput(email)
    const sanitizedName = sanitizeInput(name)

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } })
    if (existingUser) {
      return NextResponse.json({
        error: 'Un compte avec cet email existe déjà'
      }, { status: 400 })
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12)

    // Créer l'utilisateur (candidat, PAS admin)
    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password: hashedPassword,
        name: sanitizedName,
        birthDate: birthDate ? new Date(birthDate) : null,
        birthPlace,
        phone,
        address,
        role: 'USER', // Toujours USER pour les inscriptions publiques
        // ✅ FIX: Ne pas auto-vérifier l'email - l'utilisateur devra vérifier via l'email
        emailVerified: null
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true
      }
    })

    // ✅ ENVOYER EMAIL DE VÉRIFICATION
    try {
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

      await prisma.verification.create({
        data: {
          identifier: `email_verify:${user.id}`,
          value: token,
          expiresAt,
        }
      })

      const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/verify-email?token=${token}`

      // Send email (non-blocking, don't fail registration if email fails)
      emailService.sendVerificationEmail(
        sanitizedEmail,
        sanitizedName,
        verifyLink
      ).catch(err => console.error('[REGISTER] Verification email failed:', err))
    } catch (emailError) {
      // Don't fail registration if email fails
      console.error('[REGISTER] Email setup error:', emailError)
    }

    return NextResponse.json({
      message: 'Compte candidat créé avec succès. Un email de vérification a été envoyé.',
      user
    }, { status: 201 })
  } catch (error) {
    console.error('[REGISTER ERROR]', error)
    // ✅ FIX: Return proper JSON instead of relying on handleApiError
    return NextResponse.json(
      {
        error: 'Erreur lors de la création du compte',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    )
  }
}
