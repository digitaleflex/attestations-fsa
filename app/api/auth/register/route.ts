import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Schéma de validation pour l'inscription admin
const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  name: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parse = RegisterSchema.safeParse(body)
    if (!parse.success) {
      return NextResponse.json({ message: 'Entrée invalide', details: parse.error.errors }, { status: 400 })
    }
    const { email, password, name } = parse.data
    // Vérifier si l'admin existe déjà
    const existingAdmin = await prisma.admin.findUnique({ where: { email } })
    if (existingAdmin) {
      return NextResponse.json({ message: 'Un compte administrateur avec cet email existe déjà' }, { status: 400 })
    }
    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12)
    // Créer l'admin
    const admin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        role: 'ADMIN',
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
    return NextResponse.json({ message: 'Compte administrateur créé avec succès', admin }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: 'Erreur lors de la création du compte administrateur' }, { status: 500 })
  }
}
// Champs utilisés : email, password, name, role, emailVerified (tous présents dans le modèle Admin du schema.prisma)
