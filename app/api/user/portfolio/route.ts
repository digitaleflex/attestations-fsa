// app/api/user/portfolio/route.ts
// Permettre à un utilisateur de configurer son portfolio
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const PortfolioSchema = z.object({
  slug: z
    .string()
    .min(3, "Le slug doit contenir au moins 3 caractères")
    .max(50, "Le slug est trop long")
    .regex(
      /^[a-z0-9-]+$/,
      "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"
    ),
  enabled: z.boolean().optional(),
});

// GET - Récupérer les infos du portfolio de l'utilisateur
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const portfolioUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        portfolioSlug: true,
        portfolioEnabled: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json({
      slug: portfolioUser?.portfolioSlug,
      enabled: portfolioUser?.portfolioEnabled,
      portfolioUrl: portfolioUser?.portfolioSlug
        ? `/p/${portfolioUser.portfolioSlug}`
        : null,
    });
  } catch (error) {
    console.error("[PORTFOLIO_GET_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH - Configurer le portfolio
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const result = PortfolioSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Données invalides", details: result.error.errors },
        { status: 400 }
      );
    }

    const { slug, enabled } = result.data;

    // Vérifier si le slug est déjà pris
    const existingSlug = await prisma.user.findFirst({
      where: {
        portfolioSlug: slug,
        id: { not: user.id },
      },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: "Ce slug est déjà utilisé" },
        { status: 409 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        portfolioSlug: slug,
        portfolioEnabled: enabled !== undefined ? enabled : true,
      },
      select: {
        portfolioSlug: true,
        portfolioEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      portfolioUrl: `/p/${slug}`,
      ...updated,
    });
  } catch (error) {
    console.error("[PORTFOLIO_UPDATE_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
