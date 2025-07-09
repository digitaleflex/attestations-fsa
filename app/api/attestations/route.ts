import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { customAlphabet } from 'nanoid'
import { isAdminAuthenticated } from '@/lib/auth';
import { z } from 'zod';

const nanoid = customAlphabet('1234567890abcdef', 5)

// Schéma de validation pour la création d'une attestation
const AttestationSchema = z.object({
  fullName: z.string().min(1, 'Le nom complet est requis.'),
  birthDate: z.string().min(1, 'La date de naissance est requise.'),
  birthPlace: z.string().min(1, 'Le lieu de naissance est requis.'),
  formation: z.string().min(1, 'La formation est requise.'),
  startDate: z.string().min(1, 'La date de début est requise.'),
  endDate: z.string().min(1, 'La date de fin est requise.'),
  location: z.string().min(1, 'Le lieu est requis.'),
  instructor: z.string().min(1, 'Le formateur est requis.'),
  issuingCompany: z.string().min(1, 'La société émettrice est requise.'),
  type: z.enum(['FORMATION', 'STAGE', 'CERTIFICATION'], { required_error: 'Le type est requis.' }),
});

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const countOnly = url.searchParams.get('count') === '1';
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
  const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';

  // Filtre dynamique
  const where: any = {};
  if (status) where.status = status;

  if (countOnly) {
    try {
      const count = await prisma.attestation.count({ where });
      return NextResponse.json({ count });
    } catch (error) {
      return NextResponse.json({ message: "Erreur lors du comptage des attestations" }, { status: 500 });
    }
  }
  try {
    const attestations = await prisma.attestation.findMany({
      where,
      orderBy: { issuedAt: order },
      include: { formation: { select: { name: true } } },
      ...(limit ? { take: limit } : {})
    });
    return NextResponse.json(attestations);
  } catch (error) {
    return NextResponse.json({ message: "Erreur lors de la récupération des attestations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }
  try {
    const body = await request.json()
    const parse = AttestationSchema.safeParse(body)
    if (!parse.success) {
      return NextResponse.json({ message: 'Entrée invalide', details: parse.error.errors }, { status: 400 })
    }
    const {
      fullName, birthDate, birthPlace, formation, startDate, endDate, location, instructor, issuingCompany, type
    } = parse.data

    // Chercher ou créer la formation par son nom
    let formationRecord = await prisma.formation.findFirst({ where: { name: formation } })
    if (!formationRecord) {
      formationRecord = await prisma.formation.create({ data: { name: formation, category: '', skills: [] } })
    }
    const formationId = formationRecord.id

    // Génération du code d'attestation
    const now = new Date()
    const year = now.getFullYear()
    const month = `M${String(now.getMonth() + 1).padStart(2, '0')}`
    // Compter le nombre d'attestations ce mois pour le numéro séquentiel
    const count = await prisma.attestation.count({
      where: {
        issuedAt: {
          gte: new Date(`${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`),
          lt: new Date(`${year}-${String(now.getMonth() + 2).padStart(2, '0')}-01T00:00:00.000Z`)
        }
      }
    })
    const seq = String(count + 1).padStart(5, '0')
    const hash = nanoid()
    const code = `FSA-${year}-${month}-${seq}-${hash}`

    // Création de l'attestation
    const attestation = await prisma.attestation.create({
      data: {
        code,
        fullName,
        birthDate: new Date(birthDate),
        birthPlace,
        formationId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        instructor,
        issuingCompany,
        type,
        status: 'PENDING',
      }
    })
    return NextResponse.json({ message: 'Attestation créée', code }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: 'Erreur lors de la création de l\'attestation' }, { status: 500 })
  }
} 