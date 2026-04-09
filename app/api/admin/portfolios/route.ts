import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
       return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const portfolios = await prisma.user.findMany({
      where: {
        OR: [
          { portfolioStatus: "PENDING_VALIDATION" },
          { portfolioStatus: "PUBLISHED" },
          { portfolioStatus: "REJECTED" }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        portfolioStatus: true,
        portfolioSlug: true,
        updatedAt: true,
        _count: {
          select: {
            portfolioMissions: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return NextResponse.json(portfolios);
  } catch (error) {
    console.error("[ADMIN_PORTFOLIOS_GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
