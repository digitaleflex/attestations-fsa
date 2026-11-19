// app/api/users/stats/route.ts
// Statistiques globales des utilisateurs (admin uniquement)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { applyRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/error-handler";

export async function GET(request: Request) {
  try {
    if (!verifyOrigin(request)) {
      return NextResponse.json({ error: "Origin non autorisée" }, { status: 403 });
    }
    const rateLimit = await applyRateLimit(request, "adminBulk");
    if (!rateLimit.allowed && rateLimit.response) {
      return rateLimit.response;
    }
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const [total, active, verified, unverified] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { emailVerified: { not: null } } }),
      prisma.user.count({ where: { emailVerified: null } }),
    ]);

    return NextResponse.json({ total, active, verified, unverified });
  } catch (error: unknown) {
    return handleApiError(error instanceof Error ? error : new Error(String(error)), {
      route: "/api/users/stats",
      operation: "user_stats",
    });
  }
}
