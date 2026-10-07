import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { customAlphabet } from 'nanoid'
import { getAdminUser } from '@/lib/auth';
import { getSealSecret, reportSealDisabledIfProduction, sealCertificate } from '@/lib/crypto/seal';
import { sanitizeInput } from '@/lib/sanitization';
import { createAuditLog } from '@/lib/audit';
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

  // #319 — Une formation doit être référencée ou créée avec catégorie + description.
  category: z.string().min(1, 'La catégorie est requise pour une nouvelle formation.').optional(),
  description: z.string().min(1, 'La description est requise pour une nouvelle formation.').optional(),
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
      stageHours, stageScore, stageObservations,
      certificationScore, certificationMention, certificationHours
    } = parse.data

    // #322 — Refuser les champs non persistés. `certificationHoursExempted`
    // n'existe pas dans le schéma Prisma : accepter ce champ permettrait à
    // un client de croire qu'une exemption est enregistrée alors qu'elle
    // serait silencieusement ignorée.
    if (body && typeof body === 'object' && 'certificationHoursExempted' in body) {
      return NextResponse.json(
        { message: 'Champ non persisté: certificationHoursExempted' },
        { status: 400 }
      )
    }

    // #322 — Invariants par type à la création : une CERTIFICATION requiert
    // score + mention + heures ; un STAGE requiert les heures.
    if (type === 'CERTIFICATION') {
      const missing: string[] = [];
      if (certificationScore === undefined) missing.push('certificationScore');
      if (certificationMention === undefined) missing.push('certificationMention');
      if (certificationHours === undefined) missing.push('certificationHours');
      if (missing.length > 0) {
        return NextResponse.json(
          { message: `Champs requis pour CERTIFICATION: ${missing.join(', ')}` },
          { status: 400 }
        )
      }
    }
    if (type === 'STAGE' && stageHours === undefined) {
      return NextResponse.json(
        { message: 'Champ requis pour STAGE: stageHours' },
        { status: 400 }
      )
    }

    // Les certifications officielles ne peuvent être arbitraires : elles sont
    // exclusivement émises par le hub d'examen lié à une session GRADED.
    if (type === 'CERTIFICATION') {
      return NextResponse.json({
        message: 'Une certification doit être émise depuis une session OFFICIAL soumise et GRADED.',
      }, { status: 422 });
    }

    // #288 — Garde duco : le scellement est OBLIGATOIRE, y compris en dev.
    // Sans clé, on refuse l'émission AVANT toute écriture : l'écriture
    // conditionnelle du sceau créait une ligne non scellée en silence.
    // Même refus dur que le hub d'émission des certifications
    // (`lib/attestations/issue.ts:150-153`) ; statut aligné sur la mutation
    // de cycle de vie (`app/api/attestations/[id]/route.ts:231`).
    if (!getSealSecret()) {
      reportSealDisabledIfProduction();
      return NextResponse.json({ message: 'Émission bloquée : clé de scellement indisponible.' }, { status: 503 });
    }

    // #319 — Déduplication par normalisation (casse + accents) et création
    // contrôlée : une formation inconnue ne peut plus être créée vide
    // (category '', skills []). Elle doit être référencée (existante) ou
    // créée avec catégorie + description.
    const normalize = (s: string) =>
      s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedName = normalize(formation);

    let formationRecord = await prisma.formation.findFirst({
      where: { name: { contains: formation, mode: 'insensitive' } },
    });
    // Recherche exacte normalisée si la recherche insensitive ne suffit pas
    if (!formationRecord) {
      const allFormations = await prisma.formation.findMany();
      formationRecord = allFormations.find((f) => normalize(f.name) === normalizedName) ?? null;
    }

    if (!formationRecord) {
      // Formation inconnue : exiger catégorie + description
      if (!parse.data.category || !parse.data.description) {
        return NextResponse.json(
          { message: 'Formation inconnue : catégorie et description requises pour la création.' },
          { status: 400 }
        );
      }
      formationRecord = await prisma.formation.create({
        data: {
          name: formation,
          category: parse.data.category,
          description: parse.data.description,
          skills: [],
        },
      });
      // Journaliser la création de la formation
      await createAuditLog({
        userId: adminUser.id,
        action: 'RESOURCE_CREATED',
        resource: 'FORMATION',
        resourceId: formationRecord.id,
        newValue: { name: formationRecord.name, category: parse.data.category },
      });
    }
    const formationId = formationRecord.id

    // Génération du code d'attestation propre et pro : FSA-2026-M04-00003-f0f9a
    const now = new Date()
    const year = now.getFullYear()
    const month = `M${String(now.getMonth() + 1).padStart(2, '0')}`

    // #316 — nextval() est atomique et évite les P2002 en concurrence.
    const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('attestation_code_seq') AS nextval
    `;
    const seq = String(Number(nextval)).padStart(5, '0')
    const hash = nanoid()
    const code = `FSA-${year}-${month}-${seq}-${hash}`

    console.log('[POST /api/attestations] Creating record with code:', code);

    // Préparation des données
    const attestationData: Record<string, unknown> = {
      code,
      fullName: sanitizeInput(fullName),
      email: email ? email.trim().toLowerCase() : null,
      gender,
      birthDate: new Date(birthDate),
      birthPlace: sanitizeInput(birthPlace),
      formationId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location: sanitizeInput(location),
      instructor: sanitizeInput(instructor),
      issuingCompany: sanitizeInput(issuingCompany),
      type,
      status: 'PENDING',
    };

    // Ajouter les champs spécifiques selon le type
    if (type === 'STAGE') {
      attestationData.stageHours = stageHours;
      attestationData.stageScore = stageScore;
      attestationData.stageObservations = stageObservations ? sanitizeInput(stageObservations) : stageObservations;
    }

    // Scellement HMAC-SHA256 (#155) : empreinte des données gravées.
    // #300 — bascule v2 : le snapshot inclut désormais tous les champs.
    const seal = sealCertificate({
      code,
      fullName,
      type,
      status: 'PENDING',
      formationId,
      formationName: formationRecord.name,
      email: email || null,
      gender: gender ?? null,
      birthDate: birthDate ? new Date(birthDate) : null,
      birthPlace: birthPlace || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location,
      instructor,
      issuingCompany,
      // Les champs certification sont toujours inclus (null si non applicable).
      certificationScore: 'certificationScore' in parse.data ? (parse.data as any).certificationScore ?? null : null,
      certificationMention: 'certificationMention' in parse.data ? (parse.data as any).certificationMention ?? null : null,
      stageHours: type === 'STAGE' ? stageHours ?? null : null,
      stageScore: type === 'STAGE' ? stageScore ?? null : null,
      stageObservations: type === 'STAGE' ? stageObservations ?? null : null,
      sealVersion: 2,
    });

    // Défense en profondeur : si le sceau reste nul malgré la garde d'entrée,
    // on n'écrit pas de ligne sans preuve (cf. `lib/attestations/issue.ts:264`).
    if (!seal) {
      return NextResponse.json({ message: 'Émission bloquée : clé de scellement indisponible.' }, { status: 503 });
    }

    // Création de l'attestation
    await prisma.attestation.create({
      data: {
        ...attestationData,
        sealHash: seal.sealHash,
        sealedAt: seal.sealedAt,
        sealVersion: seal.sealVersion,
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
