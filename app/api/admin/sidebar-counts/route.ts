import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const [pendingPortfolios, newReports] = await Promise.all([
      prisma.user.count({ where: { portfolioStatus: "PENDING_VALIDATION" } }),
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
