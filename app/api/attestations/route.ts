import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { customAlphabet } from 'nanoid'
import { getAdminUser } from '@/lib/auth';
import { sealCertificate } from '@/lib/crypto/seal';
import { z } from 'zod';

const nanoid = customAlphabet('1234567890abcdef', 5)

// Schéma de validation pour la création d'une attestation
const AttestationSchema = z.object({
  fullName: z.string().min(1, 'Le nom complet est requis.'),
  email: z.string().email('Adresse e-mail invalide.').optional().or(z.literal('')),
  gender: z.enum(['M', 'F']).optional(),
  birthDate: z.string().min(1, 'La date de naissance est requise.'),
  birthPlace: z.string().min(1, 'Le lieu de naissance est requis.'),
  formation: z.string().min(1, 'La formation est requise.'),
  startDate: z.string().min(1, 'La date de début est requise.'),
  endDate: z.string().min(1, 'La date de fin est requise.'),
  location: z.string().min(1, 'Le lieu est requis.'),
  instructor: z.string().min(1, 'Le formateur est requis.'),
  issuingCompany: z.string().min(1, 'La société émettrice est requise.'),
  type: z.enum(['FORMATION', 'STAGE', 'CERTIFICATION'], { required_error: 'Le type est requis.' }),

  // Champs spécifiques pour STAGE
  stageHours: z.number().min(1).max(2000).optional(),
  stageScore: z.number().min(0).max(100).optional(),
  stageObservations: z.string().max(1000).optional(),

  // Champs spécifiques pour CERTIFICATION
  certificationMention: z.enum(['PASSABLE', 'ASSEZ_BIEN', 'BIEN', 'TRES_BIEN', 'EXCELLENCE']).optional(),
  certificationScore: z.number().min(0).max(100).optional(),
  certificationHours: z.number().min(1).max(2000).optional(),
  certificationObservations: z.string().max(1000).optional(),
});

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  } catch (authError) {
    console.error('[GET /api/attestations] Auth error:', authError);
    return NextResponse.json({ error: 'Erreur d\'authentification' }, { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const countOnly = url.searchParams.get('count') === '1';
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
    const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;
    const search = url.searchParams.get('search') || '';

    // Filtre dynamique
    // Filtre dynamique
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
        { formation: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (countOnly) {
      const count = await prisma.attestation.count({ where });
      return NextResponse.json({ count });
    }

    const attestations = await prisma.attestation.findMany({
      where: where as import('@prisma/client').Prisma.AttestationWhereInput,
      orderBy: { issuedAt: (order === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc' },
      include: { 
        formation: { select: { name: true } },
      },
      ...(limit ? { take: limit } : {}),
      skip: offset,
    });
    return NextResponse.json(attestations);
  } catch (error) {
    console.error('[GET /api/attestations] Error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des attestations', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const body = await request.json()
    const parse = AttestationSchema.safeParse(body)
    if (!parse.success) {
      return NextResponse.json({ message: 'Entrée invalide', details: parse.error.errors }, { status: 400 })
    }
    const {
      fullName, email, gender, birthDate, birthPlace, formation, startDate, endDate, location, instructor, issuingCompany, type,
      stageHours, stageScore, stageObservations
    } = parse.data

    // Les certifications officielles ne peuvent être arbitraires : elles sont
    // exclusivement émises par le hub d'examen lié à une session GRADED.
    if (type === 'CERTIFICATION') {
      return NextResponse.json({
        message: 'Une certification doit être émise depuis une session OFFICIAL soumise et GRADED.',
      }, { status: 422 });
    }

    // Chercher ou créer la formation par son nom
    let formationRecord = await prisma.formation.findFirst({ where: { name: formation } })
    if (!formationRecord) {
      formationRecord = await prisma.formation.create({ data: { name: formation, category: '', skills: [] } })
    }
    const formationId = formationRecord.id

    // Génération du code d'attestation propre et pro : FSA-2026-M04-00003-f0f9a
    const now = new Date()
    const year = now.getFullYear()
    const month = `M${String(now.getMonth() + 1).padStart(2, '0')}`

    // Compter les attestations du mois pour la séquence
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const count = await prisma.attestation.count({
      where: {
        issuedAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    })

    const seq = String(count + 1).padStart(5, '0')
    const hash = nanoid()
    const code = `FSA-${year}-${month}-${seq}-${hash}`

    console.log('[POST /api/attestations] Creating record with code:', code);

    // Préparation des données
    const attestationData: Record<string, unknown> = {
      code,
      fullName,
      email: email ? email.trim().toLowerCase() : null,
      gender,
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
    };

    // Ajouter les champs spécifiques selon le type
    if (type === 'STAGE') {
      attestationData.stageHours = stageHours;
      attestationData.stageScore = stageScore;
      attestationData.stageObservations = stageObservations;
    }

    // Scellement HMAC-SHA256 (#155) : empreinte des données gravées.
    const seal = sealCertificate({
      code,
      fullName,
      formationName: formationRecord.name,
      certificationScore: null,
      certificationMention: null,
      endDate: new Date(endDate),
    });

    // Création de l'attestation
    await prisma.attestation.create({
      data: {
        ...attestationData,
        ...(seal ? { sealHash: seal.sealHash, sealedAt: seal.sealedAt, sealVersion: seal.sealVersion } : {}),
      } as import('@prisma/client').Prisma.AttestationCreateInput
    })
    console.log('[POST /api/attestations] Success');
    return NextResponse.json({ message: 'Attestation créée', code }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/attestations] FATAL ERROR:', error);
    if (error instanceof z.ZodError) {
      console.error('Validation details:', error.errors);
    }
    return NextResponse.json({
      message: 'Erreur lors de la création de l\'attestation',
      debug: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
