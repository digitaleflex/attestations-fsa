import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    // On cherche les logs où resourceId est l'ID de l'attestation
    // OU resourceId est l'ID de l'utilisateur lié à cette attestation (pour les rétrogradations)
    const attestation = await prisma.attestation.findUnique({
      where: { id },
      select: { userId: true }
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { resourceId: id },
          { resourceId: attestation?.userId || 'none', resource: 'USER' }
        ]
      },
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
