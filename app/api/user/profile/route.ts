import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Schéma de validation pour la modification du profil
const UserProfileSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').optional(),
  email: z.string().email('Email invalide').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  oldPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional(),
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional(),
});

// Helper pour vérifier l'authentification user
async function isAuthenticatedUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  if (!session || !session.value) return null;
  if (role?.value !== 'USER') return null;
  
  return session.value;
}

// GET /api/user/profile - Récupérer le profil de l'utilisateur connecté
export async function GET() {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        birthDate: true,
        birthPlace: true,
        phone: true,
        address: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }
    
    return NextResponse.json(user);
  } catch (error: any) {
    console.error('Erreur profil user:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/user/profile - Mettre à jour le profil de l'utilisateur
export async function PATCH(request: Request) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }
    
    const body = await request.json();
    const parse = UserProfileSchema.safeParse(body);
    
    if (!parse.success) {
      return NextResponse.json({ 
        message: 'Données invalides', 
        details: parse.error.errors 
      }, { status: 400 });
    }
    
    const { name, email, phone, address, oldPassword, newPassword } = parse.data;
    
    // Vérifier les conflits d'email
    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: { email, id: { not: userId } }
      });
      if (existingUser) {
        return NextResponse.json({ 
          message: 'Cet email est déjà utilisé par un autre utilisateur' 
        }, { status: 400 });
      }
    }
    
    // Préparation des données à mettre à jour
    const updateData: any = {};
    
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    
    // Gestion du changement de mot de passe
    if (oldPassword && newPassword) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true }
      });
      
      if (!user?.password) {
        return NextResponse.json({ 
          message: 'Mot de passe actuel non défini' 
        }, { status: 400 });
      }
      
      const valid = await bcrypt.compare(oldPassword, user.password);
      if (!valid) {
        return NextResponse.json({ 
          message: 'Ancien mot de passe incorrect' 
        }, { status: 401 });
      }
      
      updateData.password = await bcrypt.hash(newPassword, 12);
    }
    
    // Mise à jour
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        birthDate: true,
        birthPlace: true,
      }
    });
    
    return NextResponse.json({
      message: 'Profil mis à jour avec succès',
      user: updatedUser
    });
    
  } catch (error: any) {
    console.error('Erreur mise à jour profil:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la mise à jour du profil' 
    }, { status: 500 });
  }
}
