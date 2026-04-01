import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Attestation, Formation } from '@prisma/client';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const formation = searchParams.get('formation');
    const year = searchParams.get('year');

    try {
        const where: any = {
            status: 'VALIDATED',
        };

        // Filtre de recherche
        if (search) {
            where.fullName = { contains: search, mode: 'insensitive' };
        }

        // Filtre par formation
        if (formation) {
            where.formation = {
                name: { equals: formation, mode: 'insensitive' }
            };
        }

        // Filtre par année
        if (year) {
            const yearNum = parseInt(year, 10);
            if (!isNaN(yearNum)) {
                where.issuedAt = {
                    gte: new Date(yearNum, 0, 1),
                    lt: new Date(yearNum + 1, 0, 1)
                };
            }
        }

        const alumni = await prisma.attestation.findMany({
            where,
            include: {
                formation: true,
            },
            orderBy: { issuedAt: 'desc' },
            distinct: ['fullName', 'formationId']
        });

        // Transformation pour ne pas exposer trop d'infos
        const results = (alumni as (Attestation & { formation: Formation })[]).map(a => ({
            id: a.id,
            fullName: a.fullName,
            formation: a.formation.name,
            year: new Date(a.issuedAt).getFullYear(),
        }));

        return NextResponse.json(results);
    } catch (error) {
        console.error('[API ALUMNI] Error:', error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}