import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Schéma de validation pour la connexion
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

    // Vérifier la connexion à la base de données
    await prisma.$connect()

    // Chercher d'abord dans Admin, puis dans User
    let user = await prisma.admin.findUnique({ where: { email } })
    let userType = 'ADMIN'
    
    if (!user) {
      user = await prisma.user.findUnique({ where: { email } })
      userType = 'USER'
    }
    
    if (!user) {
      return NextResponse.json({ message: 'Aucun compte trouvé avec cet email' }, { status: 401 })
    }
    
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ message: 'Mot de passe incorrect' }, { status: 401 })
    }
    
    // Création du cookie de session avec le rôle
    const response = NextResponse.json({ 
      message: 'Connexion réussie', 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        role: userType
      } 
    })
    
    response.cookies.set('admin_session', user.id, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 jours
    })
    
    response.cookies.set('user_role', userType, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })
    
    return response
  } catch (error: any) {
    console.error('Erreur détaillée login:', error)
    return NextResponse.json({
      message: 'Erreur serveur',
      error: error.message
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
