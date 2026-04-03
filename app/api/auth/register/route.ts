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
    const rateLimit = await applyRateLimit(request as any, 'register')
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
        emailVerified: new Date()
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      message: 'Compte candidat créé avec succès',
      user
    }, { status: 201 })
  } catch (error: any) {
    console.error('Erreur lors de la création du compte candidat:', error)
    return handleApiError(error, {
      route: '/api/auth/register',
      operation: 'register',
    })
  }
}
