import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { isAdminAuthenticated, getCurrentUser } from '@/lib/auth';
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
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: user.id },
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
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
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
    where: { id: user.id } 
  });

  if (!currentUser) return NextResponse.json({ message: 'Admin introuvable' }, { status: 404 });

  const updateData: any = {};

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

  if (oldPassword && newPassword) {
    if (!currentUser.password) {
        return NextResponse.json({ message: 'Compte sans mot de passe local' }, { status: 400 });
    }
    const ok = await bcrypt.compare(oldPassword, currentUser.password);
    if (!ok) {
      return NextResponse.json({ message: 'Ancien mot de passe incorrect' }, { status: 400 });
    }
    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  if (birthDate) updateData.birthDate = new Date(birthDate);
  if (birthPlace) updateData.birthPlace = birthPlace;
  if (phone) updateData.phone = phone;
  if (address) updateData.address = address;

  const updatedAdmin = await prisma.user.update({ 
    where: { id: currentUser.id }, 
    data: updateData 
  });

  return NextResponse.json({ 
    id: updatedAdmin.id, 
    name: updatedAdmin.name, 
    email: updatedAdmin.email,
    birthDate: updatedAdmin.birthDate?.toISOString().slice(0, 10),
    birthPlace: updatedAdmin.birthPlace,
    phone: updatedAdmin.phone,
    address: updatedAdmin.address,
  });
}
