import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { AttestationType, AttestationStatus } from '@prisma/client';
import { z } from "zod";
import { getCurrentUser } from '@/lib/auth';

// Schéma de validation des paramètres
const QuerySchema = z.object({
  status: z.nativeEnum(AttestationStatus).optional().or(z.literal("all")),
  type: z.nativeEnum(AttestationType).optional().or(z.literal("all")),
  limit: z.coerce.number().min(1).max(100).optional(),
});

interface AttestationStats {
  total: number;
  validated: number;
  pending: number;
  rejected: number;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    
    const userId = user.id;
    
    // Validation avec Zod (Sécurité Totale)
    const url = new URL(request.url);
    const params = QuerySchema.safeParse({
      status: url.searchParams.get('status') || undefined,
      type: url.searchParams.get('type') || undefined,
      limit: url.searchParams.get('limit') || undefined,
    });

    if (!params.success) {
      return NextResponse.json({ error: 'Paramètres invalides', details: params.error.format() }, { status: 400 });
    }

    const { status: statusParam, type: typeParam, limit } = params.data;
    
    // Mapping des Enums
    const status = (statusParam && statusParam !== 'all') ? (statusParam as AttestationStatus) : undefined;
    const type = (typeParam && typeParam !== 'all') ? (typeParam as AttestationType) : undefined;

    // Récupérer les attestations directement par userId (Optimisé par Index)
    const attestations = await prisma.attestation.findMany({
      where: {
        userId: userId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      include: {
        formation: {
          select: {
            id: true,
            name: true,
            category: true,
          }
        }
      },
      orderBy: { issuedAt: 'desc' },
      ...(limit ? { take: limit } : {})
    });
    
    // Calcul des statistiques (en mémoire) - Type Safe
    const stats: AttestationStats = {
      total: attestations.length,
      validated: attestations.filter(a => a.status === 'VALIDATED').length,
      pending: attestations.filter(a => a.status === 'PENDING').length,
      rejected: attestations.filter(a => a.status === 'REJECTED').length,
    };
    
    return NextResponse.json({
      attestations,
      stats
    });
    
  } catch (error: unknown) {
    console.error('Erreur attestations user:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des attestations' 
    }, { status: 500 });
  }
}
