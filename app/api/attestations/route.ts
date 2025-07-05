import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { customAlphabet } from 'nanoid'
import { isAdminAuthenticated } from '@/lib/auth';

const nanoid = customAlphabet('1234567890abcdef', 5)

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
    const {
      fullName, birthDate, birthPlace, formation, startDate, endDate, location, instructor, issuingCompany, type
    } = body
    if (!fullName || !birthDate || !birthPlace || !formation || !startDate || !endDate || !location || !instructor || !issuingCompany || !type) {
      return NextResponse.json({ message: 'Tous les champs sont requis.' }, { status: 400 })
    }

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