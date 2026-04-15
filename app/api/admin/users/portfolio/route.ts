// app/api/admin/users/portfolio/route.ts
// Admin: gérer les portfolios des utilisateurs
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const PortfolioUpdateSchema = z.object({
  userId: z.string().uuid("ID utilisateur invalide"),
  slug: z.string().optional(),
  enabled: z.boolean().optional(),
});

// GET - Lister les utilisateurs avec portfolios
export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const enabledOnly = searchParams.get("enabled") === "true";
    const search = searchParams.get("search");

    const users = await prisma.user.findMany({
      where: {
        portfolioEnabled: enabledOnly ? true : undefined,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { portfolioSlug: { contains: search, mode: "insensitive" } },
          ]
        } : {})
      },
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
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
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

    const updateData: Partial<{ portfolioSlug: string; portfolioEnabled: boolean }> = {};
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

    // 🛡️ Audit Log
    await createAuditLog({
      userId: adminUser.id,
      action: 'USER_PORTFOLIO_UPDATED' as "USER_PORTFOLIO_UPDATED",
      resource: 'USER_PORTFOLIO',
      resourceId: userId,
      newValue: { slug: updated.portfolioSlug, enabled: updated.portfolioEnabled },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown"
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN_PORTFOLIO_UPDATE_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
