// app/api/exams/monitoring/route.ts
// Receives and logs exam monitoring events (tab switches, blur, etc.)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const MonitoringEventSchema = z.object({
  type: z.enum(['VISIBILITY_CHANGE', 'BLUR', 'FOCUS', 'WINDOW_RESIZE', 'MULTIPLE_WINDOWS']),
  timestamp: z.number(),
  details: z.string().optional(),
});

const MonitoringPayloadSchema = z.object({
  events: z.array(MonitoringEventSchema),
  examId: z.string(),
  userId: z.string(),
  timestamp: z.number(),
});

/**
 * POST /api/exams/monitoring
 * Receives monitoring events from client and logs them to SecurityLog
 */
export async function POST(request: Request) {
  // ✅ ANTI-CHEAT: DISABLED by request
  return NextResponse.json({ received: 0, logged: 0, disabled: true });
}

/**
 * GET /api/exams/monitoring?examId=xxx
 * Returns monitoring events for an exam (admin only)
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    if (!examId) {
      return NextResponse.json({ error: 'examId requis' }, { status: 400 });
    }

    const logs = await prisma.securityLog.findMany({
      where: {
        resourceId: examId,
        eventType: 'EXAM_MONITORING',
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('[EXAM MONITORING GET ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
