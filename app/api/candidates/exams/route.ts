import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const exams = await prisma.exam.findMany({
      where: {
        OR: [
          { status: 'PUBLISHED' },
          {
            AND: [
              { status: 'SCHEDULED' },
              { scheduledAt: { lte: new Date() } }
            ]
          }
        ]
      },
      include: {
        sessions: {
          where: { userId: session.user.id }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Check if the user already has a submission
    const examsWithStatus = exams.map(exam => ({
      ...exam,
      hasSubmitted: (exam as any).sessions.length > 0
    }));

    return NextResponse.json(examsWithStatus);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la récupération des examens" }, { status: 500 });
  }
}
