import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { z } from 'zod';

export async function GET(request: Request) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({ contacts, total });

  } catch (error) {
    console.error('[GET /api/admin/contacts] Error:', error);
    return NextResponse.json({ error: 'Erreur récupération contacts' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);

  } catch (error) {
    console.error('[PATCH /api/admin/contacts] Error:', error);
    return NextResponse.json({ error: 'Erreur mise à jour contact' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });

  } catch (error) {
     console.error('[DELETE /api/admin/contacts] Error:', error);
     return NextResponse.json({ error: 'Erreur suppression contact' }, { status: 500 });
  }
}
