// app/api/admin/exams/route.ts
// Admin routes for exam management
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Simple cookie-based admin auth (matches other admin routes)
async function isAuthenticatedAdmin(): Promise<string | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const session = cookieStore.get('better-auth.session_token')
  const roleCookie = cookieStore.get('better-auth.session_data')

  if (!session?.value) return null

  try {
    const sessionData = JSON.parse(decodeURIComponent(roleCookie?.value || '{}'))
    if (sessionData.user?.role !== 'ADMIN') return null
    return sessionData.user.id || null
  } catch {
    return null
  }
}

const ExamSchema = z.object({
  name: z.string().min(1),
  session: z.string().optional(),
  description: z.string().optional(),
  formationId: z.string(),
  duration: z.number().default(3600),
  passingScore: z.number().default(60),
  part1Enabled: z.boolean().default(true),
  part1Questions: z.number().default(20),
  part1Points: z.number().default(20),
  part2Enabled: z.boolean().default(true),
  part2Questions: z.number().default(5),
  part2Points: z.number().default(40),
  part3Enabled: z.boolean().default(true),
  part3Subject: z.string().optional(),
  part3Points: z.number().default(40),
  part3Mode: z.string().default('digital'),
  randomizeQuestions: z.boolean().default(false),
  showResults: z.boolean().default(false),
  status: z.string().default('DRAFT'),
  qcmQuestions: z.array(z.any()).default([]),
  openQuestions: z.array(z.any()).default([]),
});

// POST /api/admin/exams - Create a new exam
export async function POST(request: Request) {
  try {
    const adminId = await isAuthenticatedAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé - Admin requis' }, { status: 401 });
    }

    const body = await request.json();
    const parse = ExamSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({
        message: 'Entrée invalide',
        details: parse.error.errors
      }, { status: 400 });
    }

    const {
      name, session, description, formationId, duration, passingScore,
      part1Enabled, part1Questions, part1Points,
      part2Enabled, part2Questions, part2Points,
      part3Enabled, part3Subject, part3Points, part3Mode,
      randomizeQuestions, showResults, status,
      qcmQuestions = [], openQuestions = [],
    } = parse.data;

    // Verify formation exists
    const formation = await prisma.formation.findUnique({
      where: { id: formationId }
    });

    if (!formation) {
      return NextResponse.json({
        message: 'Formation non trouvée'
      }, { status: 404 });
    }

    const totalPoints = (part1Enabled ? part1Points : 0) +
                        (part2Enabled ? part2Points : 0) +
                        (part3Enabled ? part3Points : 0);

    if (totalPoints === 0) {
      return NextResponse.json({
        message: 'Au moins une partie doit être activée avec des points'
      }, { status: 400 });
    }

    // ✅ NO $transaction - Accelerate limits to 15s max
    // Use sequential individual queries with manual rollback

    // Step 1: Create exam
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

    // Track created items for rollback
    const createdQuestionIds: string[] = [];
    const createdPartIds: string[] = [];

    try {
      // Step 2: Create Part 1 (QCM) - individual queries
      if (part1Enabled && qcmQuestions.length > 0) {
        const part1 = await prisma.examPart.create({
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
          const question = await prisma.question.create({
            data: {
              partId: part1.id,
              text: q.text || `Question QCM ${i + 1}`,
              type: q.type || "SINGLE_CHOICE",
              points: q.points || 1,
              order: i + 1,
            }
          });
          createdQuestionIds.push(question.id);

          if (q.options && q.options.length > 0) {
            await prisma.questionOption.createMany({
              data: q.options.map((opt: any) => ({
                questionId: question.id,
                text: opt.text || "...",
                isCorrect: opt.isCorrect,
                feedback: opt.feedback || "",
              }))
            });
          }
        }
      }

      // Step 3: Create Part 2 (Open Questions) - individual queries
      if (part2Enabled && openQuestions.length > 0) {
        const part2 = await prisma.examPart.create({
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
          const question = await prisma.question.create({
            data: {
              partId: part2.id,
              text: qData.text || `Question ouverte ${i + 1}`,
              type: "OPEN",
              points: qData.points || 5,
              order: i + 1,
            }
          });
          createdQuestionIds.push(question.id);
        }
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
      // Manual rollback in reverse order
      console.error('[EXAM CREATION ERROR] Rolling back...', error);
      for (const qId of createdQuestionIds) {
        await prisma.question.delete({ where: { id: qId } }).catch(() => {});
      }
      for (const partId of createdPartIds) {
        await prisma.examPart.delete({ where: { id: partId } }).catch(() => {});
      }
      await prisma.exam.delete({ where: { id: newExam.id } }).catch(() => {});
      throw error;
    }

    return NextResponse.json({
      message: 'Examen créé avec succès',
      exam: newExam
    }, { status: 201 });

  } catch (error: any) {
    console.error('Erreur création examen:', error);
    return NextResponse.json({
      error: 'Erreur lors de la création de l\'examen'
    }, { status: 500 });
  }
}

// GET /api/admin/exams - List all exams
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
