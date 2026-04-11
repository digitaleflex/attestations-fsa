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
  try {
    const user = await getCurrentUser(request);
    const body = await request.json();
    
    // Validate payload
    const payload = MonitoringPayloadSchema.parse(body);
    
    // Ensure user is reporting for themselves (unless admin)
    if (!user || (user.id !== payload.userId && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Create logs for each event
    const logs = await Promise.all(payload.events.map(event => 
      prisma.securityLog.create({
        data: {
          userId: payload.userId,
          eventType: 'EXAM_MONITORING',
          severity: 'INFO',
          action: event.type,
          resourceId: payload.examId,
          details: event.details || `Automatic event: ${event.type}`,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          timestamp: new Date(event.timestamp),
        }
      })
    ));

    return NextResponse.json({ 
      received: payload.events.length, 
      logged: logs.length,
      success: true 
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
