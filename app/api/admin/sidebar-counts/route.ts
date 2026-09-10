import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // NOTE: fonctionnalité Portfolio non déployée (pas de User.portfolioStatus
    // dans prisma/schema.prisma) — compteur neutralisé à 0, forme inchangée.
    const [pendingPortfolios, newReports] = await Promise.all([
      Promise.resolve(0),
      prisma.report.count({ where: { status: "NEW" } }),
    ]);

    return NextResponse.json({
      pendingPortfolios,
      newReports,
    });
  } catch (error) {
    return NextResponse.json({ pendingPortfolios: 0, newReports: 0 });
  }
}
