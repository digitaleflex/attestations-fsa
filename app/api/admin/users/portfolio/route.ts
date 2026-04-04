// app/api/admin/users/portfolio/route.ts
// Admin: gérer les portfolios des utilisateurs
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { z } from "zod";

const PortfolioUpdateSchema = z.object({
  userId: z.string().uuid("ID utilisateur invalide"),
  slug: z.string().optional(),
  enabled: z.boolean().optional(),
});

// GET - Lister les utilisateurs avec portfolios
export async function GET(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const enabledOnly = searchParams.get("enabled") === "true";
    const search = searchParams.get("search");

    const where: any = {};
    if (enabledOnly) {
      where.portfolioEnabled = true;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { portfolioSlug: { contains: search, mode: "insensitive" as const } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        portfolioSlug: true,
        portfolioEnabled: true,
        createdAt: true,
        _count: {
          select: {
            attestations: true,
            examSessions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      users,
      total: users.length,
    });
  } catch (error) {
    console.error("[ADMIN_PORTFOLIO_GET_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH - Mettre à jour le portfolio d'un utilisateur
export async function PATCH(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const result = PortfolioUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Données invalides", details: result.error.errors },
        { status: 400 }
      );
    }

    const { userId, slug, enabled } = result.data;

    // Vérifier si le slug est déjà pris
    if (slug) {
      const existingSlug = await prisma.user.findFirst({
        where: {
          portfolioSlug: slug,
          id: { not: userId },
        },
      });

      if (existingSlug) {
        return NextResponse.json(
          { error: "Ce slug est déjà utilisé" },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (slug !== undefined) updateData.portfolioSlug = slug;
    if (enabled !== undefined) updateData.portfolioEnabled = enabled;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        portfolioSlug: true,
        portfolioEnabled: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN_PORTFOLIO_UPDATE_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
