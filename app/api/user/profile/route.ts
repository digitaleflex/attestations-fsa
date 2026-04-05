import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';

// Schéma de validation pour la modification du profil
const UserProfileSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').optional(),
  email: z.string().email('Email invalide').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  oldPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional(),
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional(),
  gender: z.enum(['M', 'F']).optional(),
});

// GET /api/user/profile - Récupérer le profil de l'utilisateur connecté
export async function GET(request: Request) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }

    const userId = userSession.id;
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
        gender: true,
        emailVerified: true,
        createdAt: true,
        correctionRequests: {
          where: { status: "PENDING" },
          take: 1
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: unknown) {
    console.error('Erreur profil user:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/user/profile - Mettre à jour le profil de l'utilisateur
export async function PATCH(request: Request) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }

    const userId = userSession.id;

    const body = await request.json();
    const parse = UserProfileSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({
        message: 'Données invalides',
        details: parse.error.errors
      }, { status: 400 });
    }

    const { name, email, phone, address, birthDate, birthPlace, gender, oldPassword, newPassword } = parse.data;

    // 🔒 SÉCURITÉ: Vérifier si l'utilisateur tente de changer des données d'identité critiques
    // après avoir déjà passé un examen ou obtenu une attestation.
    const hasCritialUpdate = name || birthDate || birthPlace;

    if (hasCritialUpdate) {
      const hasOfficialHistory = await prisma.examSession.findFirst({
        where: { userId }
      }) || await prisma.attestation.findFirst({
        where: { userId }
      });

      if (hasOfficialHistory) {
        return NextResponse.json({
          message: 'Vos données d\'identité (nom, date/lieu de naissance) sont verrouillées car vous avez un historique officiel (examen ou attestation). Veuillez utiliser le formulaire de demande de correction.',
          code: 'IDENTITY_LOCKED'
        }, { status: 403 });
      }
    }

    // Vérifier les conflits d'email
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } }
      });
      if (existingUser) {
        return NextResponse.json({
          message: 'Cet email est déjà utilisé par un autre utilisateur'
        }, { status: 400 });
      }
    }

    // Préparation des données à mettre à jour
    const updateData: import('@prisma/client').Prisma.UserUpdateInput = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (birthDate) updateData.birthDate = new Date(birthDate);
    if (birthPlace) updateData.birthPlace = birthPlace;
    if (gender) updateData.gender = gender;

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
        gender: true,
      }
    });

    return NextResponse.json({
      message: 'Profil mis à jour avec succès',
      user: updatedUser
    });

  } catch (error: unknown) {
    console.error('Erreur mise à jour profil:', error);
    return NextResponse.json({
      error: 'Erreur lors de la mise à jour du profil'
    }, { status: 500 });
  }
}
