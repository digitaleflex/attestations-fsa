import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await getCurrentUser(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    
    const userId = userAuth.id;
    
    // ÉTAPE 1 : Requêtes de base en PARALLÈLE
    const [user, allUserAttestations, examSubmissions, internshipApplications] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, createdAt: true }
      }),
      prisma.attestation.findMany({
        where: { userId: userId },
        select: { id: true, status: true, issuedAt: true }
      }),
      prisma.examSession.findMany({
        where: { userId: userId },
        select: { 
            totalScore: true, 
            submittedAt: true,
            exam: { select: { passingScore: true, totalPoints: true } } 
        }
      }),
      prisma.user.findUnique({
          where: { id: userId },
          select: { email: true }
      }).then(u => u?.email ? prisma.internshipRequest.findMany({
        where: { email: u.email },
        select: { status: true }
      }) : [])
    ]);

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // ÉTAPE 2 : Calculs Statistiques en MÉMOIRE (Ultra-rapide)
    const validAttestations = allUserAttestations.filter(a => a.status === 'VALIDATED');
    const attestationsCount = validAttestations.length;
    
    const examsCompleted = examSubmissions.length;
    const examsPassed = examSubmissions.filter((sub) => {
      const maxPoints = sub.exam?.totalPoints || 100;
      const scorePercent = maxPoints > 0 ? Math.round((sub.totalScore / maxPoints) * 100) : 0;
      const passingScore = sub.exam?.passingScore || 60;
      return scorePercent >= passingScore;
    }).length;

    const averageScore = examsCompleted > 0
      ? Math.round(
          examSubmissions.reduce((sum, sub) => {
            const maxPoints = sub.exam?.totalPoints || 100;
            return sum + (maxPoints > 0 ? Math.round((sub.totalScore / maxPoints) * 100) : 0);
          }, 0) / examsCompleted
        )
      : 0;
    
    const internshipsApplied = internshipApplications.length;
    const internshipsAccepted = internshipApplications.filter((i) => i.status === 'ACCEPTED').length;
    
    // Activité récente et progression mensuelle
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    
    const recentActivity = {
      attestationsLast7Days: validAttestations.filter(a => a.issuedAt && new Date(a.issuedAt) >= sevenDaysAgo).length,
      examsLast7Days: examSubmissions.filter((e) => e.submittedAt && new Date(e.submittedAt) >= sevenDaysAgo).length,
    };
    
    // Progression par mois (6 derniers mois) calculée en une seule boucle
    const monthlyProgression = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(now.getMonth() - i);
      
      const m = monthDate.getMonth();
      const y = monthDate.getFullYear();
      
      const count = validAttestations.filter(a => {
          const d = new Date(a.issuedAt);
          return d.getMonth() === m && d.getFullYear() === y;
      }).length;
      
      monthlyProgression.push({
        month: monthDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        attestations: count,
      });
    }
    
    // Badges 
    const badges = [];
    if (attestationsCount >= 1) badges.push({ id: 'first_cert', name: 'Premier Certificat', icon: '🎓' });
    if (attestationsCount >= 5) badges.push({ id: 'five_certs', name: '5 Certificats', icon: '🏆' });
    if (examsPassed >= 1) badges.push({ id: 'first_exam', name: 'Premier Examen Réussi', icon: '✅' });
    if (averageScore >= 90) badges.push({ id: 'excellence', name: 'Excellence', icon: '⭐' });
    
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
    
  } catch (err: unknown) {
    console.error('Erreur statistiques user:', err);
    return NextResponse.json({ error: 'Erreur lors de la récupération des statistiques' }, { status: 500 });
  }
}
