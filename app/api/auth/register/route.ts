import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

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
    const body = await request.json()
    const parse = RegisterSchema.safeParse(body)
    if (!parse.success) {
      return NextResponse.json({ 
        message: 'Données invalides', 
        details: parse.error.errors 
      }, { status: 400 })
    }
    const { email, password, name, birthDate, birthPlace, phone, address } = parse.data
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ 
        message: 'Un compte avec cet email existe déjà' 
      }, { status: 400 })
    }
    
    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12)
    
    // Créer l'utilisateur (candidat, PAS admin)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
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
  } catch (error) {
    console.error('Erreur lors de la création du compte candidat:', error)
    return NextResponse.json({ 
      message: 'Erreur lors de la création du compte' 
    }, { status: 500 })
  }
}
