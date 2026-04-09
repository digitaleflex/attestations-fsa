// app/api/submissions/route.ts
// Gestion des soumissions (liste et mise à jour - admin uniquement)
// ✅ FIX: Standardisation du format de réponse d'erreur
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { handleApiError } from '@/lib/error-handler';
import type { Prisma } from '@prisma/client';
import type { ExamSessionStatus } from '@/lib/prisma-types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Non autorisé - Authentification admin requise' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const examId = url.searchParams.get('examId');

    // ✅ FIX: Use Prisma type instead of `any`
    const where: Prisma.ExamSessionWhereInput = {};
    if (userId) where.userId = userId;
    if (examId) where.examId = examId;

    const submissions = await prisma.examSession.findMany({
      where,
      include: {
        exam: true,
        candidate: true
      },
      orderBy: { submittedAt: 'desc' }
    });
    return NextResponse.json(submissions);
  } catch (error: any) {
    console.error(error);
    return handleApiError(error, {
      route: '/api/submissions',
      operation: 'list_submissions',
    });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Non autorisé - Authentification admin requise' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, scorePart1, scorePart2, scorePart3, status, gradedBy } = body;

    const totalScore = (scorePart1 || 0) + (scorePart2 || 0) + (scorePart3 || 0);

    const submission = await prisma.examSession.update({
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
  } catch (error: any) {
    console.error(error);
    return handleApiError(error, {
      route: '/api/submissions',
      operation: 'update_submission',
    });
  }
}
