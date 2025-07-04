import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ message: 'Email et mot de passe requis' }, { status: 400 })
    }
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