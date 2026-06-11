import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Exécution de toutes les requêtes d'agrégation en parallèle
    const [
      totalUsers,
      newUsersThisMonth,
      totalAdmins,
      pendingPortfolios,
      newReports,
      totalAttestations,
      validatedExams,
      recentAttestations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.user.count({ where: { portfolioStatus: 'PENDING_VALIDATION' } }),
      prisma.report.count({ where: { status: 'NEW' } }),
      prisma.attestation.count(),
      prisma.examSession.count({ where: { status: 'PASSED' } }),
      prisma.attestation.findMany({
        take: 5,
        orderBy: { issuedAt: 'desc' },
        include: { formation: { select: { name: true } } }
      })
    ]);

    return NextResponse.json({
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
        admins: totalAdmins,
        candidates: totalUsers - totalAdmins,
      },
      actionable: {
        pendingPortfolios,
        newReports,
      },
      pedagogy: {
        totalAttestations,
        validatedExams,
        recentAttestations,
      }
    });

  } catch (error) {
    console.error("[DASHBOARD_OVERVIEW_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
