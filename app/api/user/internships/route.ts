import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Helper pour vérifier l'authentification user
async function isAuthenticatedUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  if (!session || !session.value) return null;
  if (role?.value !== 'USER') return null;
  
  return session.value;
}

// Schéma de validation pour une candidature
const InternshipApplicationSchema = z.object({
  internshipId: z.string().uuid('ID de stage invalide'),
  coverLetter: z.string().min(10, 'La lettre de motivation doit contenir au moins 10 caractères').optional(),
  cvUrl: z.string().url('URL du CV invalide').optional(),
});

// GET /api/user/internships - Récupérer les candidatures de l'utilisateur
export async function GET(request: Request) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }
    
    // Récupérer les candidatures du candidat
    const applications = await prisma.candidateProfile.findMany({
      where: {
        userId: userId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Statistiques
    const stats = {
      total: applications.length,
      pending: applications.filter((a: any) => a.status === 'PENDING').length,
      inReview: applications.filter((a: any) => a.status === 'IN_REVIEW').length,
      accepted: applications.filter((a: any) => a.status === 'ACCEPTED').length,
      rejected: applications.filter((a: any) => a.status === 'REJECTED').length,
    };
    
    return NextResponse.json({
      applications,
      stats
    });
    
  } catch (error: any) {
    console.error('Erreur stages user:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des candidatures' 
    }, { status: 500 });
  }
}

// POST /api/user/internships - Postuler à un stage
export async function POST(request: Request) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }
    
    const body = await request.json();
    const parse = InternshipApplicationSchema.safeParse(body);
    
    if (!parse.success) {
      return NextResponse.json({ 
        message: 'Données invalides', 
        details: parse.error.errors 
      }, { status: 400 });
    }
    
    const { internshipId, coverLetter, cvUrl } = parse.data;
    
    // Vérifier que le candidat n'a pas déjà postulé
    const existingApplication = await prisma.candidateProfile.findFirst({
      where: {
        userId: userId,
        // Ajoutez ici un filtre par internshipId si votre schema le permet
      }
    });
    
    if (existingApplication) {
      return NextResponse.json({ 
        message: 'Vous avez déjà postulé à ce stage' 
      }, { status: 400 });
    }
    
    // Créer la candidature
    const application = await prisma.candidateProfile.create({
      data: {
        userId: userId,
        // Adaptez les champs selon votre schema
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
    
    return NextResponse.json({
      message: 'Candidature soumise avec succès',
      application
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Erreur candidature stage:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la soumission de la candidature' 
    }, { status: 500 });
  }
}
