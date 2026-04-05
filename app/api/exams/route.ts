import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { z } from 'zod';

const ExamSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).default('DRAFT'),
  scheduledAt: z.string().optional().nullable(),
  parts: z.array(z.object({
    title: z.string(),
    type: z.string(),
    duration: z.number(),
    points: z.number(),
    order: z.number(),
    scenario: z.string().optional(),
    questions: z.array(z.object({
      text: z.string(),
      type: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'OPEN']),
      points: z.number(),
      order: z.number(),
      options: z.array(z.object({
        text: z.string(),
        isCorrect: z.boolean()
      })).optional()
    })).optional()
  })).min(3).max(3)
});

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const exams = await prisma.exam.findMany({
      include: {
        _count: {
          select: { sessions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(exams);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la récupération des examens" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parse = ExamSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({ message: 'Entrée invalide', details: parse.error.errors }, { status: 400 });
    }

    const { title, description, status, scheduledAt, parts } = parse.data;

    const exam = await prisma.exam.create({
      data: {
        title,
        name: title, // title and name are both in schema
        description,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        parts: {
          create: parts.map((part) => ({
            title: part.title,
            type: part.type,
            duration: part.duration,
            points: part.points,
            order: part.order,
            scenario: part.scenario,
            questions: {
              create: part.questions?.map((q) => ({
                text: q.text,
                type: q.type,
                points: q.points,
                order: q.order,
                options: {
                  create: q.options?.map((o) => ({
                    text: o.text,
                    isCorrect: o.isCorrect
                  }))
                }
              }))
            }
          }))
        }
      },
      include: {
        parts: {
          include: {
            questions: {
              include: {
                options: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(exam, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la création de l'examen" }, { status: 500 });
  }
}
