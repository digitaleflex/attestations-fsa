// app/api/admin/corrections/route.ts
// Admin routes for managing correction requests
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

// GET - List all correction requests (admin only)
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [corrections, total] = await Promise.all([
      prisma.correctionRequest.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          attestation: { select: { id: true, code: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.correctionRequest.count({ where }),
    ]);

    return NextResponse.json({
      corrections,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/corrections ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des demandes de correction" },
      { status: 500 }
    );
  }
}
