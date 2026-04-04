// app/api/public/portfolios/route.ts
// API publique pour lister les portfolios activés
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Lister les portfolios publics activés
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = parseInt(searchParams.get("skip") || "0");

    const where = {
      portfolioEnabled: true,
      portfolioSlug: { not: null },
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { portfolioSlug: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          portfolioSlug: true,
          birthDate: true,
          birthPlace: true,
          phone: true,
          address: true,
          role: true,
          createdAt: true,
          // Count their attestations
          _count: {
            select: {
              attestations: true,
              examSessions: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      portfolios: users.map((u: any) => ({
        ...u,
        attestationCount: u._count?.attestations || 0,
        examCount: u._count?.examSessions || 0,
        // Generate public URL
        portfolioUrl: `/portfolios/${u.portfolioSlug}`,
        // Anonymize email
        email: u.email ? `${u.email.charAt(0)}***@${u.email.split("@")[1]}` : null,
      })),
      total,
      hasMore: skip + users.length < total,
    });
  } catch (error) {
    console.error("[PORTFOLIOS_LIST_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
