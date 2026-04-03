// app/api/admin/security-logs/route.ts
// Admin route for viewing security logs
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

// GET - List security logs (admin only)
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const severity = url.searchParams.get("severity");
    const eventType = url.searchParams.get("eventType");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (severity) where.severity = severity;
    if (eventType) where.eventType = eventType;

    const [logs, total] = await Promise.all([
      prisma.securityLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
      prisma.securityLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/security-logs ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des logs de sécurité" },
      { status: 500 }
    );
  }
}
