import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { isAdminAuthenticated } from '@/lib/auth';
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
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
  }
  const admin = await prisma.admin.findFirst({
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
  return NextResponse.json(admin);
}

// PATCH /api/admin - Mettre à jour le profil de l'admin
export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const body = await request.json();
  const parse = AdminProfileSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ message: 'Entrée invalide', details: parse.error.errors }, { status: 400 });
  }
  const { name, email, oldPassword, newPassword, birthDate, birthPlace, phone, address } = parse.data;
  let admin = await prisma.admin.findFirst();
  if (!admin) return NextResponse.json({ message: 'Admin introuvable' }, { status: 404 });

  const updateData: any = {};

  // Modification du nom
  if (name) {
    updateData.name = name;
  }

  // Modification de l'email
  if (email && email !== admin.email) {
    const existing = await prisma.admin.findFirst({ where: { email, id: { not: admin.id } } });
    if (existing) {
      return NextResponse.json({ message: 'Cet email est déjà utilisé' }, { status: 400 });
    }
    updateData.email = email;
  }

  // Modification du mot de passe
  if (oldPassword && newPassword) {
    const ok = await bcrypt.compare(oldPassword, admin.password);
    if (!ok) {
      return NextResponse.json({ message: 'Ancien mot de passe incorrect' }, { status: 400 });
    }
    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  // Modification des informations personnelles
  if (birthDate) {
    updateData.birthDate = new Date(birthDate);
  }
  if (birthPlace) {
    updateData.birthPlace = birthPlace;
  }
  if (phone) {
    updateData.phone = phone;
  }
  if (address) {
    updateData.address = address;
  }

  // Mettre à jour l'admin
  admin = await prisma.admin.update({ 
    where: { id: admin.id }, 
    data: updateData 
  });

  return NextResponse.json({ 
    id: admin.id, 
    name: admin.name, 
    email: admin.email,
    birthDate: admin.birthDate?.toISOString().slice(0, 10),
    birthPlace: admin.birthPlace,
    phone: admin.phone,
    address: admin.address,
  });
}
