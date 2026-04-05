import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600; // Cache results for 1 hour

export async function GET() {
  try {
    const [validated, pending, settings, totalUsers] = await Promise.all([
      prisma.attestation.count({
        where: { status: 'VALIDATED' },
      }),
      prisma.attestation.count({
        where: { status: 'PENDING' },
      }),
      prisma.settings.findFirst(),
      prisma.user.count({ where: { role: 'user' } }),
    ]);

    return NextResponse.json({
      validated,
      pending,
      totalUsers,
      targets: {
        attestations: settings?.targetAttestations || 300,
        inscriptions: settings?.targetInscriptions || 500,
        validations: settings?.targetValidations || 450,
      },
      cachedAt: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
      }
    });
    } catch (error) {
        console.error('[API STATS] Error:', error);
        return NextResponse.json(
            { message: 'Erreur lors de la récupération des statistiques' },
            { status: 500 }
        );
    }
}
