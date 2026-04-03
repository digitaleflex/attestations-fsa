import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiErrorImpl } from '@/lib/error-handler';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        parts: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: true 
              }
            }
          }
        }
      }
    });

    if (!exam) {
      throw new ApiErrorImpl('NOT_FOUND', "Examen non trouvé");
    }

    // Sécurité: On ne renvoie PAS les bonnes réponses (isCorrect)
    const secureExam = {
      ...exam,
      parts: exam.parts.map(part => ({
        ...part,
        questions: part.questions.map(q => ({
          ...q,
          options: q.options?.map(o => ({
            id: o.id,
            text: o.text
          }))
        }))
      }))
    };

    return NextResponse.json(secureExam);
  } catch (error) {
    return handleApiError(error, { route: '/api/candidates/exams/[id]' });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { answers } = body; 

    // 1. Fetch the exam with correct options for scoring Part 1
    const exam = await prisma.exam.findUnique({
      where: { id },
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

    if (!exam) {
      throw new ApiErrorImpl('NOT_FOUND', "Examen non trouvé");
    }

    // 2. Score Part 1 (QCM) automagically
    let scorePart1 = 0;
    const part1 = exam.parts.find(p => p.type === 'QCM');
    if (part1) {
      part1.questions.forEach(q => {
        const userAnswer = answers[q.id];
        if (!userAnswer) return;

        if (q.type === 'SINGLE_CHOICE') {
          const correctOption = q.options.find(o => o.isCorrect);
          if (correctOption && correctOption.id === userAnswer) {
            scorePart1 += q.points;
          }
        } else if (q.type === 'MULTIPLE_CHOICE') {
          const correctIds = q.options.filter(o => o.isCorrect).map(o => o.id);
          const isCorrect = Array.isArray(userAnswer) &&
            userAnswer.length === correctIds.length &&
            userAnswer.every(id => correctIds.includes(id));
          
          if (isCorrect) scorePart1 += q.points;
        }
      });
    }

    // 3. Create session
    const sessionRecord = await prisma.examSession.create({
      data: {
        examId: id,
        userId: user.id,
        status: "PENDING",
        scorePart1,
        scorePart2: 0,
        scorePart3: 0,
        totalScore: scorePart1 
      }
    });

    return NextResponse.json(sessionRecord);
  } catch (error) {
    return handleApiError(error, { route: '/api/candidates/exams/[id]' });
  }
}
