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

// GET /api/user/attestations - Récupérer les attestations de l'utilisateur
export async function GET(request: Request) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }
    
    // Récupérer les paramètres de requête
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
    
    // Construire le filtre WHERE
    const where: any = {
      // Les attestations sont liées à l'utilisateur via le nom et la date de naissance
      // On utilise une correspondance approximative
      OR: [
        { 
          // Correspondance exacte sur le nom (à améliorer avec un vrai système de liaison)
          fullName: { 
            contains: await getUserName(userId),
            mode: 'insensitive'
          } 
        }
      ]
    };
    
    // Filtres optionnels
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (type && type !== 'all') {
      where.type = type;
    }
    
    // Récupérer les attestations
    const attestations = await prisma.attestation.findMany({
      where,
      include: {
        formation: {
          select: {
            id: true,
            name: true,
            category: true,
          }
        }
      },
      orderBy: { issuedAt: 'desc' },
      ...(limit ? { take: limit } : {})
    });
    
    // Compter par statut
    const stats = {
      total: attestations.length,
      validated: attestations.filter((a: any) => a.status === 'VALIDATED').length,
      pending: attestations.filter((a: any) => a.status === 'PENDING').length,
      rejected: attestations.filter((a: any) => a.status === 'REJECTED').length,
    };
    
    return NextResponse.json({
      attestations,
      stats
    });
    
  } catch (error: any) {
    console.error('Erreur attestations user:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des attestations' 
    }, { status: 500 });
  }
}

// Helper pour récupérer le nom de l'utilisateur
async function getUserName(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true }
  });
  return user?.name || '';
}
