import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [validated, pending] = await Promise.all([
            prisma.attestation.count({
                where: { status: 'VALIDATED' },
            }),
            prisma.attestation.count({
                where: { status: 'PENDING' },
            }),
        ]);

        return NextResponse.json({
            validated,
            pending,
        }, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, max-age=0',
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
