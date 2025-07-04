import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  console.log('Début de la requête d\'inscription admin')
  try {
    const body = await request.json()
    console.log('Corps de la requête reçu:', JSON.stringify(body, null, 2))
    
    const { email, password, name } = body
    
    // Validation des données
    if (!email || !password) {
      console.error('Email ou mot de passe manquant')
      return NextResponse.json(
        { message: 'Email et mot de passe sont requis' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      )
    }

    console.log('Recherche d\'un administrateur existant avec l\'email:', email)
    
    // Vérifier si l'administrateur existe déjà
    const existingAdmin = await prisma.admin.findUnique({
      where: { email }
    })

    if (existingAdmin) {
      console.log('Administrateur existant trouvé:', existingAdmin.id)
      return NextResponse.json(
        { message: 'Un compte administrateur avec cet email existe déjà' },
        { status: 400 }
      )
    }

    console.log('Aucun administrateur existant trouvé, création d\'un nouveau compte')
    
    try {
      // Hacher le mot de passe
      console.log('Hachage du mot de passe...')
      const hashedPassword = await bcrypt.hash(password, 12)

      console.log('Création de l\'administrateur dans la base de données...')
      
      // Créer l'administrateur
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

      console.log('Administrateur créé avec succès:', admin.id)
      
      return NextResponse.json(
        { 
          user: admin, 
          message: 'Compte administrateur créé avec succès' 
        },
        { status: 201 }
      )
    } catch (dbError) {
      console.error('Erreur lors de la création de l\'administrateur dans la base de données:', dbError)
      return NextResponse.json(
        { message: 'Erreur lors de la création du compte administrateur' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error)
    return NextResponse.json(
      { message: 'Une erreur est survenue lors de l\'inscription' },
      { status: 500 }
    )
  }
}
