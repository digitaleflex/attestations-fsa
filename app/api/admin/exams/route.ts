import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Helper pour vérifier l'authentification admin
async function isAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  if (!session || !session.value) return null;
  if (role?.value !== 'ADMIN') return null;
  
  return session.value;
}

// Schéma de validation pour la création d'examen
const CreateExamSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  formationId: z.string().min(1, 'ID de formation requis'),
  duration: z.number().min(300).max(28800), // 5 min à 8 heures
  passingScore: z.number().min(0).max(100),
  part1Enabled: z.boolean().default(true),
  part1Questions: z.number().min(0).max(100).default(20),
  part1Points: z.number().min(0).max(100).default(20),
  part2Enabled: z.boolean().default(true),
  part2Questions: z.number().min(0).max(50).default(5),
  part2Points: z.number().min(0).max(100).default(40),
  part3Enabled: z.boolean().default(true),
  part3Subject: z.string().optional(),
  part3Points: z.number().min(0).max(100).default(40),
  part3Mode: z.string().default('digital'),
  randomizeQuestions: z.boolean().default(false),
  showResults: z.boolean().default(false),
});

// POST /api/admin/exams - Créer un examen
export async function POST(request: Request) {
  try {
    const adminId = await isAuthenticatedAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
    }

    const body = await request.json();
    const parse = CreateExamSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({ 
        message: 'Données invalides', 
        details: parse.error.errors 
      }, { status: 400 });
    }

    const {
      name,
      description,
      formationId,
      duration,
      passingScore,
      part1Enabled,
      part1Questions,
      part1Points,
      part2Enabled,
      part2Questions,
      part2Points,
      part3Enabled,
      part3Subject,
      part3Points,
      part3Mode,
      randomizeQuestions,
      showResults,
    } = parse.data;

    // Vérifier que la formation existe
    const formation = await prisma.formation.findUnique({
      where: { id: formationId }
    });

    if (!formation) {
      return NextResponse.json({ 
        message: 'Formation non trouvée' 
      }, { status: 404 });
    }

    // Calculer le total des points
    const totalPoints = (part1Enabled ? part1Points : 0) +
                        (part2Enabled ? part2Points : 0) +
                        (part3Enabled ? part3Points : 0);

    if (totalPoints === 0) {
      return NextResponse.json({ 
        message: 'Au moins une partie doit être activée avec des points' 
      }, { status: 400 });
    }

    // Créer l'examen
    const exam = await prisma.exam.create({
      data: {
        name,
        title: name,
        description,
        formationId,
        duration,
        passingScore,
        totalPoints,
        part1Enabled,
        part1Questions,
        part1Points,
        part2Enabled,
        part2Questions,
        part2Points,
        part3Enabled,
        part3Subject,
        part3Points,
        part3Mode,
        randomizeQuestions,
        showResults,
        status: 'DRAFT', // DRAFT, PUBLISHED, ARCHIVED
      },
      include: {
        formation: true
      }
    });

    return NextResponse.json({
      message: 'Examen créé avec succès',
      exam
    }, { status: 201 });

  } catch (error: any) {
    console.error('Erreur création examen:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la création de l\'examen' 
    }, { status: 500 });
  }
}

// GET /api/admin/exams - Lister tous les examens
export async function GET() {
  try {
    const adminId = await isAuthenticatedAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
    }

    const exams = await prisma.exam.findMany({
      include: {
        formation: true,
        sessions: {
          select: {
            id: true,
            status: true,
            candidate: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        _count: {
          select: {
            sessions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(exams);

  } catch (error: any) {
    console.error('Erreur liste examens:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des examens' 
    }, { status: 500 });
  }
}
