import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { handleApiError } from '@/lib/error-handler';
import { z } from 'zod';

// Schéma de validation pour la modification d'une formation
const FormationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').optional(),
  category: z.string().min(1, 'La catégorie est requise.').optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

// ✅ FIX: Next.js 15 compatible - params is a Promise
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const parse = FormationSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Entrée invalide', details: parse.error.errors }, { status: 400 });
    }
    const data = parse.data;
    const formation = await prisma.formation.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.skills !== undefined ? { skills: data.skills } : {}),
      },
    });
    return NextResponse.json(formation);
  } catch (error: unknown) {
    // #321 — l'erreur Prisma de l'update ne part plus au client (contrainte,
    //        nom de colonne, valeur). Détail journalisé + Sentry ; générique
    //        en production, message lisible en développement.
    return handleApiError(error, {
      route: '/api/formations/[id]',
      operation: 'update_formation',
      userId: adminUser.id ?? undefined,
    });
  }
}

// ✅ FIX: Next.js 15 compatible - params is a Promise
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    await prisma.formation.delete({ where: { id } });
    return NextResponse.json({ message: 'Formation supprimée' });
  } catch (error: unknown) {
    // #321 — idem PATCH : la violation de clé étrangère / la contrainte
    //        Prisma ne sont plus exposées au client.
    return handleApiError(error, {
      route: '/api/formations/[id]',
      operation: 'delete_formation',
      userId: adminUser.id ?? undefined,
    });
  }
}

// ✅ FIX: Next.js 15 compatible - params is a Promise
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const formation = await prisma.formation.findUnique({ where: { id } });
    if (!formation) {
      return NextResponse.json({ error: 'Formation non trouvée' }, { status: 404 });
    }
    return NextResponse.json(formation);
  } catch (error: unknown) {
    // #321 — idem : la lecture ne renvoie plus son erreur technique au client.
    return handleApiError(error, {
      route: '/api/formations/[id]',
      operation: 'get_formation',
      userId: adminUser.id ?? undefined,
    });
  }
}
