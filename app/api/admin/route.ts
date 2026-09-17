import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { getAdminUser } from '@/lib/auth';
import { z } from 'zod';

// Schéma de validation pour la modification du profil admin
const AdminProfileSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').optional(),
  email: z.string().email('Email invalide').optional(),
  oldPassword: z.string().min(8, 'L\'ancien mot de passe doit contenir au moins 8 caractères').optional(),
  newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères').optional(),
  // Nouveaux champs pour les attestations
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// GET /api/admin - Récupérer le profil de l'admin connecté
export async function GET(request: Request) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: adminUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      birthDate: true,
      birthPlace: true,
      phone: true,
      address: true,
    }
  });

  if (!admin) return NextResponse.json({ message: 'Compte introuvable' }, { status: 404 });
  return NextResponse.json(admin);
}

// PATCH /api/admin - Mettre à jour le profil de l'admin
export async function PATCH(request: Request) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await request.json();
  const parse = AdminProfileSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ message: 'Entrée invalide', details: parse.error.errors }, { status: 400 });
  }

  const { name, email, oldPassword, newPassword, birthDate, birthPlace, phone, address } = parse.data;

  // On récupère les infos complètes (incluant le password pour comparaison)
  const currentUser = await prisma.user.findUnique({
    where: { id: adminUser.id }
  });

  if (!currentUser) return NextResponse.json({ message: 'Admin introuvable' }, { status: 404 });

  const updateData: Record<string, unknown> = {};

  if (name) updateData.name = name;

  if (email && email !== currentUser.email) {
    const existing = await prisma.user.findFirst({
      where: { email, id: { not: currentUser.id } }
    });
    if (existing) {
      return NextResponse.json({ message: 'Cet email est déjà utilisé' }, { status: 400 });
    }
    updateData.email = email;
  }

  let newHashedPassword = "";
  if (oldPassword && newPassword) {
    if (!currentUser.password) {
        return NextResponse.json({ message: 'Compte sans mot de passe local' }, { status: 400 });
    }
    // Vérification avec l'algorithme compatible Better Auth
    const ok = await verifyPassword({
        hash: currentUser.password,
        password: oldPassword,
    });
    if (!ok) {
      return NextResponse.json({ message: 'Ancien mot de passe incorrect' }, { status: 400 });
    }
    newHashedPassword = await hashPassword(newPassword);
    updateData.password = newHashedPassword;
  }

  if (birthDate) updateData.birthDate = new Date(birthDate);
  if (birthPlace) updateData.birthPlace = birthPlace;
  if (phone) updateData.phone = phone;
  if (address) updateData.address = address;

  const result = await (prisma as any).$transaction(async (tx: any) => {
    const updatedAdmin = await tx.user.update({
      where: { id: currentUser.id },
      data: updateData
    });

    // Synchronisation avec la table Account
    if (newHashedPassword || (email && email !== currentUser.email)) {
      await tx.account.updateMany({
        where: { userId: currentUser.id, providerId: 'credential' },
        data: {
          ...(newHashedPassword ? { password: newHashedPassword } : {}),
          // Better Auth 1.7 : accountId d'un compte credential = user.id (jamais l'email).
          accountId: currentUser.id
        }
      });
    }

    return updatedAdmin;
  });

  return NextResponse.json({
    id: result.id,
    name: result.name,
    email: result.email,
    birthDate: result.birthDate?.toISOString().slice(0, 10),
    birthPlace: result.birthPlace,
    phone: result.phone,
    address: result.address,
  });
}
