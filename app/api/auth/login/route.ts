import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Schéma de validation pour la connexion admin
const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parse = LoginSchema.safeParse(body)
    if (!parse.success) {
      return NextResponse.json({ message: 'Entrée invalide', details: parse.error.errors }, { status: 400 })
    }
    const { email, password } = parse.data
    const admin = await prisma.admin.findUnique({ where: { email } })
    if (!admin) {
      return NextResponse.json({ message: 'Aucun compte admin trouvé' }, { status: 401 })
    }
    const valid = await bcrypt.compare(password, admin.password)
    if (!valid) {
      return NextResponse.json({ message: 'Mot de passe incorrect' }, { status: 401 })
    }
    // Création du cookie de session (accessible côté client)
    const response = NextResponse.json({ message: 'Connexion réussie', admin: { id: admin.id, email: admin.email, name: admin.name } })
    response.cookies.set('admin_session', admin.id, {
      // httpOnly: true, // retiré pour accès JS
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 jours
    })
    return response
  } catch (error) {
    return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 })
  }
} 