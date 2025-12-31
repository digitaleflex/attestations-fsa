import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { Attestation, Formation } from '@prisma/client';

// Schéma de validation pour la requête
const QuerySchema = z.string().min(3, "La recherche doit contenir au moins 3 caractères");

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    // Validation
    const validation = QuerySchema.safeParse(query);
    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    try {
        const alumni = await prisma.attestation.findMany({
            where: {
                status: 'VALIDATED',
                OR: [
                    { fullName: { contains: query!, mode: 'insensitive' } },
                ]
            },
            include: {
                formation: true,
            },
            take: 5,
            orderBy: { issuedAt: 'desc' }
        });

        // Transformation pour ne pas exposer trop d'infos
        const results = (alumni as (Attestation & { formation: Formation })[]).map(a => ({
            name: a.fullName,
            formation: a.formation.name,
            year: new Date(a.issuedAt).getFullYear(),
        }));

        return NextResponse.json(results);
    } catch (error) {
        console.error('[API ALUMNI] Error:', error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}