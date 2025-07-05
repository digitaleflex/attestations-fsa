import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { isAdminAuthenticated } from '@/lib/auth';

// GET /api/admin
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  const admin = await prisma.admin.findFirst({ select: { id: true, name: true, email: true } });
  return NextResponse.json(admin);
}

// PATCH /api/admin
export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  const body = await request.json();
  const { name, oldPassword, newPassword } = body;
  let admin = await prisma.admin.findFirst();
  if (!admin) return NextResponse.json({ message: 'Admin introuvable' }, { status: 404 });

  // Modification du nom
  if (name) {
    admin = await prisma.admin.update({ where: { id: admin.id }, data: { name } });
  }

  // Modification du mot de passe
  if (oldPassword && newPassword) {
    const ok = await bcrypt.compare(oldPassword, admin.password);
    if (!ok) return NextResponse.json({ message: 'Ancien mot de passe incorrect' }, { status: 400 });
    const hash = await bcrypt.hash(newPassword, 10);
    admin = await prisma.admin.update({ where: { id: admin.id }, data: { password: hash } });
  }

  return NextResponse.json({ id: admin.id, name: admin.name, email: admin.email });
} 