// app/api/admin/audit-logs/route.ts
// Admin route for viewing audit logs
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

// GET - List audit logs (admin only)
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const resource = url.searchParams.get("resource");
    const userId = url.searchParams.get("userId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
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
    console.error("[GET /api/admin/audit-logs ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des logs d'audit" },
      { status: 500 }
    );
  }
}
