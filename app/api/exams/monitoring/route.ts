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
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = MonitoringPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Payload invalide', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { events, examId } = parseResult.data;

    // Filter only suspicious events (ignore FOCUS events)
    const suspiciousEvents = events.filter(
      (e) => e.type === 'VISIBILITY_CHANGE' || e.type === 'MULTIPLE_WINDOWS'
    );

    if (suspiciousEvents.length === 0) {
      return NextResponse.json({ received: events.length, logged: 0 });
    }

    // Count tab switches and multiple windows
    const tabSwitches = suspiciousEvents.filter((e) => e.type === 'VISIBILITY_CHANGE' && e.details === 'hidden').length;
    const multipleWindows = suspiciousEvents.filter((e) => e.type === 'MULTIPLE_WINDOWS').length;

    // Determine severity
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (tabSwitches >= 5 || multipleWindows >= 2) {
      severity = 'CRITICAL';
    } else if (tabSwitches >= 3 || multipleWindows >= 1) {
      severity = 'HIGH';
    } else if (tabSwitches >= 1) {
      severity = 'MEDIUM';
    }

    // Log to SecurityLog
    await prisma.securityLog.create({
      data: {
        eventType: 'EXAM_MONITORING',
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || '',
        resource: 'exam_session',
        resourceId: examId,
        action: 'SUSPICIOUS_BEHAVIOR',
        status: 'FLAGGED',
        severity,
        details: {
          totalEvents: events.length,
          suspiciousEvents: suspiciousEvents.length,
          tabSwitches,
          multipleWindows,
          events: suspiciousEvents.map((e) => ({
            type: e.type,
            timestamp: new Date(e.timestamp).toISOString(),
            details: e.details,
          })),
        } as any,
      },
    });

    // If critical, also flag the exam session
    if (severity === 'CRITICAL') {
      await prisma.examSession.updateMany({
        where: {
          examId,
          userId: user.id,
          status: 'IN_PROGRESS',
        },
        data: {
          scorePart3: -1, // Flag for review (use part3 as it's often manual grading)
        },
      });
    }

    return NextResponse.json({
      received: events.length,
      logged: suspiciousEvents.length,
      severity,
      warning: severity === 'HIGH' || severity === 'CRITICAL'
        ? 'Comportement suspect détecté. Votre examen sera vérifié.'
        : undefined,
    });
  } catch (error) {
    console.error('[EXAM MONITORING ERROR]', error);
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
