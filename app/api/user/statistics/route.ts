import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Helper pour vérifier l'authentification user
async function isAuthenticatedUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  if (!session || !session.value) return null;
  if (role?.value !== 'USER') return null;
  
  return session.value;
}

// GET /api/user/statistics - Récupérer les statistiques de l'utilisateur
export async function GET(request: Request) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }
    
    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }
    
    // Compter les attestations
    const attestationsCount = await prisma.attestation.count({
      where: {
        fullName: user.name,
        status: 'VALIDATED'
      }
    });
    
    // Compter les examens
    const examSessions = await prisma.examSession.findMany({
      where: { candidateId: userId },
      select: {
        status: true,
        score: true,
        completedAt: true,
      }
    });
    
    const examsCompleted = examSessions.filter((e: any) => e.status === 'COMPLETED').length;
    const examsPassed = examSessions.filter((e: any) => 
      e.status === 'COMPLETED' && e.score >= 70
    ).length;
    const averageScore = examsCompleted > 0
      ? Math.round(examSessions
          .filter((e: any) => e.status === 'COMPLETED')
          .reduce((sum: number, e: any) => sum + (e.score || 0), 0) / examsCompleted)
      : 0;
    
    // Compter les candidatures de stage
    const internshipApplications = await prisma.candidateProfile.findMany({
      where: { userId },
      select: { status: true }
    });
    
    const internshipsApplied = internshipApplications.length;
    const internshipsAccepted = internshipApplications.filter((i: any) => i.status === 'ACCEPTED').length;
    
    // Activité récente (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentActivity = {
      attestationsLast7Days: await prisma.attestation.count({
        where: {
          fullName: user.name,
          issuedAt: { gte: sevenDaysAgo }
        }
      }),
      examsLast7Days: examSessions.filter((e: any) => 
        e.completedAt && new Date(e.completedAt) >= sevenDaysAgo
      ).length,
    };
    
    // Progression par mois (6 derniers mois)
    const monthlyProgression = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      const attestationsInMonth = await prisma.attestation.count({
        where: {
          fullName: user.name,
          issuedAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });
      
      monthlyProgression.push({
        month: monthDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        attestations: attestationsInMonth,
      });
    }
    
    // Badges et accomplissements
    const badges = [];
    
    if (attestationsCount >= 1) badges.push({ id: 'first_cert', name: 'Premier Certificat', icon: '🎓' });
    if (attestationsCount >= 5) badges.push({ id: 'five_certs', name: '5 Certificats', icon: '🏆' });
    if (attestationsCount >= 10) badges.push({ id: 'ten_certs', name: '10 Certificats', icon: '👑' });
    if (examsPassed >= 1) badges.push({ id: 'first_exam', name: 'Premier Examen Réussi', icon: '✅' });
    if (averageScore >= 90) badges.push({ id: 'excellence', name: 'Excellence', icon: '⭐' });
    if (internshipsAccepted >= 1) badges.push({ id: 'first_internship', name: 'Premier Stage', icon: '💼' });
    
    return NextResponse.json({
      overview: {
        memberSince: user.createdAt,
        totalAttestations: attestationsCount,
        totalExams: examsCompleted,
        examsPassed,
        averageScore,
        totalInternships: internshipsApplied,
        internshipsAccepted,
      },
      recentActivity,
      monthlyProgression,
      badges,
    });
    
  } catch (error: any) {
    console.error('Erreur statistiques user:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des statistiques' 
    }, { status: 500 });
  }
}
