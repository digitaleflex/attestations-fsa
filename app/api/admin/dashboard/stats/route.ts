import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // 1. Statistiques mensuelles (Derniers 6 mois)
    const attestations = await prisma.attestation.findMany({
      where: { issuedAt: { gte: sixMonthsAgo } },
      select: { issuedAt: true, type: true, status: true }
    });

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo }, role: 'USER' },
      select: { createdAt: true }
    });

    // Initialiser les mois
    const labels: string[] = [];
    const monthlyData: Record<string, { registrations: number, attestations: number, validations: number }> = {};
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      labels.push(label);
      monthlyData[label] = { registrations: 0, attestations: 0, validations: 0 };
    }

    // Remplir les données attestations
    attestations.forEach(a => {
      const label = new Date(a.issuedAt).toLocaleDateString('fr-FR', { month: 'short' });
      if (monthlyData[label]) {
        monthlyData[label].attestations++;
        if (a.status === 'VALIDATED') monthlyData[label].validations++;
      }
    });

    // Remplir les données utilisateurs
    users.forEach(u => {
      const label = new Date(u.createdAt).toLocaleDateString('fr-FR', { month: 'short' });
      if (monthlyData[label]) {
        monthlyData[label].registrations++;
      }
    });

    // 2. Répartition par type (Global)
    const typeCounts = await prisma.attestation.groupBy({
        by: ['type'],
        _count: { id: true }
    }) as Array<{ type: string; _count: { id: number } }>;

    // 3. Récupérer les objectifs (Settings)
    const settings = await prisma.settings.findFirst();

    return NextResponse.json({
      labels,
      series: {
        registrations: labels.map(l => monthlyData[l].registrations),
        attestations: labels.map(l => monthlyData[l].attestations),
        validations: labels.map(l => monthlyData[l].validations),
      },
      distribution: typeCounts.map(t => ({
          type: t.type,
          count: t._count.id
      })),
      targets: {
          inscriptions: settings?.targetInscriptions || 100,
          attestations: settings?.targetAttestations || 50,
          validations: settings?.targetValidations || 40
      }
    });

  } catch (error) {
    console.error("[DASHBOARD_STATS_ERROR]", error);
    return NextResponse.json({ message: "Erreur" }, { status: 500 });
  }
}
