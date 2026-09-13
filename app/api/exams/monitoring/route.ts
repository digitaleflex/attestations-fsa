import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { evaluateEnforcement, logEnforcement } from '@/lib/exam-enforcement';

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
 * Logs monitoring events and returns enforcement actions if thresholds are exceeded.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const body = await request.json();
    
    const payload = MonitoringPayloadSchema.parse(body);
    
    if (!user || (user.id !== payload.userId && user.role?.toLowerCase() !== 'admin')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const ua = request.headers.get('user-agent') || 'unknown';

    // #145 A4 — N+1 évité : un seul insert groupé au lieu d'un par événement.
    if (payload.events.length > 0) {
      await prisma.securityLog.createMany({
        data: payload.events.map((event) => ({
          userId: payload.userId,
          eventType: 'EXAM_MONITORING',
          severity: 'INFO',
          action: event.type,
          status: 'LOGGED',
          resourceId: payload.examId,
          details: event.details || `Automatic event: ${event.type}`,
          ipAddress: ip,
          userAgent: ua,
          timestamp: new Date(event.timestamp),
        })),
      });
    }

    const enforcement = await evaluateEnforcement(payload.examId, payload.userId);

    if (enforcement.lockAnswers || enforcement.forceSubmit) {
      await logEnforcement(payload.examId, payload.userId, enforcement, ip, ua);
    }

    return NextResponse.json({ 
      received: payload.events.length,
      logged: payload.events.length,
      enforcement,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload invalide', details: error.errors }, { status: 400 });
    }
    console.error('[EXAM MONITORING POST ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * GET /api/exams/monitoring?examId=xxx
 * Returns monitoring events for an exam (admin only)
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role?.toLowerCase() !== 'admin') {
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
