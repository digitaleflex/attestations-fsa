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
  university: z.string().min(2, 'L’université est requise').optional(),
  level: z.string().min(2, 'Le niveau est requis').optional(),
  position: z.string().min(2, 'Le poste souhaité est requis'),
  cvUrl: z.string().url('URL du CV invalide').optional().or(z.literal('')),
  message: z.string().min(10, 'La motivation doit contenir au moins 10 caractères').optional(),
});

// GET /api/user/internships - Récupérer les candidatures de l'utilisateur
export async function GET(request: Request) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé - Connexion requise' }, { status: 401 });
    }
    
    // Récupérer les candidatures liées à cet utilisateur
    const applications = await prisma.internshipRequest.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Statistiques
    const stats = {
      total: applications.length,
      pending: applications.filter((a: any) => a.status === 'PENDING').length,
      inReview: applications.filter((a: any) => a.status === 'REVIEWING').length,
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
    
    const { university, level, position, cvUrl, message } = parse.data;

    // Récupérer les infos de l'utilisateur pour pré-remplir la demande
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }
    
    // Créer la candidature
    const application = await prisma.internshipRequest.create({
      data: {
        userId: userId,
        fullName: user.name || "Candidat Anonyme",
        email: user.email || "",
        phone: user.phone || "",
        university,
        level,
        position,
        cvUrl: cvUrl || null,
        message,
        status: 'PENDING',
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
