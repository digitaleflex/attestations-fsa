import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// Refreshed for prisma schema sync
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
  session: z.string().optional(),
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
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  qcmQuestions: z.array(z.any()).optional(),
  openQuestions: z.array(z.any()).optional(),
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
      session,
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
      status,
      qcmQuestions = [],
      openQuestions = [],
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

    // ✅ Split into small sequential transactions to avoid Accelerate 15s limit
    // Step 1: Create the exam
    const newExam = await prisma.exam.create({
      data: {
        name,
        title: name,
        session,
        description,
        formationId,
        duration,
        passingScore,
        totalPoints,
        part1Enabled,
        part1Questions: qcmQuestions.length || part1Questions,
        part1Points,
        part2Enabled,
        part2Questions: openQuestions.length || part2Questions,
        part2Points,
        part3Enabled,
        part3Subject,
        part3Points,
        part3Mode,
        randomizeQuestions,
        showResults,
        status,
      }
    });

    // Track created parts for rollback on error
    const createdPartIds: string[] = [];

    try {
      // Step 2: Create Part 1 (QCM) with questions
      if (part1Enabled && qcmQuestions.length > 0) {
        await prisma.$transaction(async (tx) => {
          const part1 = await tx.examPart.create({
            data: {
              examId: newExam.id,
              title: "Partie 1 : QCM",
              type: "QCM",
              duration: Math.floor(duration / 3 / 60),
              points: part1Points,
              order: 1,
            }
          });
          createdPartIds.push(part1.id);

          for (let i = 0; i < qcmQuestions.length; i++) {
            const q = qcmQuestions[i];
            const question = await tx.question.create({
              data: {
                partId: part1.id,
                text: q.text || `Question QCM ${i + 1}`,
                type: q.type || "SINGLE_CHOICE",
                points: q.points || 1,
                order: i + 1,
              }
            });

            if (q.options && q.options.length > 0) {
              await tx.questionOption.createMany({
                data: q.options.map((opt: any) => ({
                  questionId: question.id,
                  text: opt.text || "...",
                  isCorrect: opt.isCorrect,
                  feedback: opt.feedback || "",
                }))
              });
            }
          }
        });
      }

      // Step 3: Create Part 2 (Open Questions) with questions
      if (part2Enabled && openQuestions.length > 0) {
        await prisma.$transaction(async (tx) => {
          const part2 = await tx.examPart.create({
            data: {
              examId: newExam.id,
              title: "Partie 2 : Questions Ouvertes",
              type: "OPEN",
              duration: Math.floor(duration / 3 / 60),
              points: part2Points,
              order: 2,
            }
          });
          createdPartIds.push(part2.id);

          for (let i = 0; i < openQuestions.length; i++) {
            const qData = openQuestions[i];
            await tx.question.create({
              data: {
                partId: part2.id,
                text: qData.text || `Question ouverte ${i + 1}`,
                type: "OPEN",
                points: qData.points || 5,
                order: i + 1,
              }
            });
          }
        });
      }

      // Step 4: Create Part 3 (Case Study)
      if (part3Enabled) {
        await prisma.examPart.create({
          data: {
            examId: newExam.id,
            title: "Partie 3 : Étude de Cas",
            type: "CASE_STUDY",
            duration: Math.floor(duration / 3 / 60),
            points: part3Points,
            order: 3,
            scenario: part3Subject,
          }
        });
      }
    } catch (error) {
      // Rollback: delete exam and created parts on error
      console.error('[EXAM CREATION ERROR] Rolling back...', error);
      for (const partId of createdPartIds) {
        await prisma.examPart.delete({ where: { id: partId } }).catch(() => {});
      }
      await prisma.exam.delete({ where: { id: newExam.id } }).catch(() => {});
      throw error;
    }

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
