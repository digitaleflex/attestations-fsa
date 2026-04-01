import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const examId = url.searchParams.get('examId');

  try {
    const where: any = {};
    if (userId) where.userId = userId;
    if (examId) where.examId = examId;

    const submissions = await prisma.examSubmission.findMany({
      where,
      include: {
        exam: true,
        user: true
      },
      orderBy: { submittedAt: 'desc' }
    });
    return NextResponse.json(submissions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la récupération des soumissions" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, scorePart1, scorePart2, scorePart3, status, gradedBy } = body;

    const totalScore = (scorePart1 || 0) + (scorePart2 || 0) + (scorePart3 || 0);

    const submission = await prisma.examSubmission.update({
      where: { id },
      data: {
        scorePart1,
        scorePart2,
        scorePart3,
        totalScore,
        status,
        gradedBy,
        gradedAt: new Date()
      }
    });

    return NextResponse.json(submission);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la mise à jour de la note" }, { status: 500 });
  }
}
