import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const severity = searchParams.get("severity");
    const type = searchParams.get("type"); // "SECURITY" or "AUDIT"

    // Fetch Security Logs
    const securityQuery: any = {
      take: limit,
      orderBy: { timestamp: "desc" },
      include: {
        // userId is optional, we might need a way to link it manually if needed 
        // or just rely on the details/userId field
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
        // ✅ EXAM MONITORING: Tab switches and cheating detections
        prisma.securityLog.count({ where: { eventType: "EXAM_MONITORING" } }),
        prisma.securityLog.count({ where: { eventType: "CHEATING_DETECTED" } }),
        prisma.securityLog.count({ where: { severity: "CRITICAL" } }),
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
        // ✅ EXAM MONITORING stats
        tabSwitchEvents: stats[4],
        cheatingDetections: stats[5],
        criticalEvents: stats[6],
      }
    });
  } catch (error) {
    console.error("[GET /api/admin/monitoring ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
