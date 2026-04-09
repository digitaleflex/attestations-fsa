import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const severity = searchParams.get("severity");

    // Fetch Security Logs with User context
    const securityQuery: any = {
      take: limit,
      orderBy: { timestamp: "desc" },
      include: {
        user: { 
            select: { 
                name: true, 
                email: true, 
                id: true 
            } 
        }
      }
    };

    if (severity) securityQuery.where = { severity };

    // Fetch Audit Logs
    const auditQuery: any = {
      take: limit,
      orderBy: { timestamp: "desc" },
      include: {
        user: { select: { name: true, email: true } }
      }
    };

    // Parallel fetch for speed
    const [securityLogs, auditLogs, stats] = await Promise.all([
      prisma.securityLog.findMany(securityQuery),
      prisma.auditLog.findMany(auditQuery),
      // Aggregate stats for dashboard
      Promise.all([
        prisma.securityLog.count({ where: { severity: "HIGH" } }),
        prisma.securityLog.count({ where: { action: "SUBMISSION_TOO_FAST" } }),
        prisma.examSession.count({ where: { status: "COMPLETED" } }),
        prisma.user.count({ where: { role: "USER" } }),
        prisma.securityLog.count({ where: { eventType: "EXAM_MONITORING" } }),
        prisma.securityLog.count({ where: { eventType: "CHEATING_DETECTED" } }),
        prisma.securityLog.count({ where: { severity: "CRITICAL" } }),
        prisma.examSession.count({ where: { status: "PENDING_REVIEW" } }),
      ])
    ]);

    return NextResponse.json({
      securityLogs,
      auditLogs,
      stats: {
        highSeverityCount: stats[0],
        submissionFlags: stats[1],
        totalExamsCompleted: stats[2],
        totalCandidates: stats[3],
        tabSwitchEvents: stats[4],
        cheatingDetections: stats[5],
        criticalEvents: stats[6],
        pendingReviewCount: stats[7],
      }
    });
  } catch (error) {
    console.error("[GET /api/admin/monitoring ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

