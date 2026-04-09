import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export async function GET(request: Request) {
  if (!await isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    // 1. Évolution des inscriptions sur les 30 derniers jours
    const thirtyDaysAgo = subDays(new Date(), 30);
    const usersByDay = await prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        role: 'user'
      },
      _count: true,
    });

    // Formatter pour le graphique
    const dailyUsers = Array.from({ length: 30 }).map((_, i) => {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = usersByDay.filter(u => format(u.createdAt, 'yyyy-MM-dd') === dateStr).reduce((acc, curr) => acc + curr._count, 0);
      return { date: format(date, 'dd/MM'), count };
    }).reverse();

    // 2. Performances par formation
    const formations = await prisma.formation.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { attestations: true }
        }
      }
    });

    const formationStats = formations.map(f => ({
      name: f.name.length > 20 ? f.name.slice(0, 20) + '...' : f.name,
      attestations: f._count.attestations
    }));

    // 3. Taux de réussite global (basé sur les examens)
    const examSessions = await prisma.examSession.groupBy({
      by: ['status'],
      _count: true
    });

    const sessionStats = examSessions.map(s => ({
      name: s.status === 'COMPLETED' ? 'Admis' : s.status === 'PENDING_REVIEW' ? 'En correction' : 'En cours',
      value: s._count
    }));

    return NextResponse.json({
      dailyUsers,
      formationStats,
      sessionStats,
      summary: {
        totalFormations: await prisma.formation.count(),
        totalSubmissions: await prisma.examSession.count(),
        totalMissions: await prisma.portfolioMission.count()
      }
    });
  } catch (error) {
    console.error('[ADVANCED_STATS_ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
