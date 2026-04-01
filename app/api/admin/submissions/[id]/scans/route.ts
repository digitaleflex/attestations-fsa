import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Helper pour vérifier l'authentification admin
async function isAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  if (!session || !session.value) return null;
  if (role?.value !== 'ADMIN') return null;
  
  return session.value;
}

// GET /api/admin/submissions/[id]/scans - Récupérer les scans
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await isAuthenticatedAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

    const submission = await prisma.examSubmission.findUnique({
      where: { id },
      include: {
        scans: {
          orderBy: { pageNumber: 'asc' }
        }
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Soumission non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ scans: submission.scans });

  } catch (error: any) {
    console.error('Erreur scans:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des scans' 
    }, { status: 500 });
  }
}

// POST /api/admin/submissions/[id]/scans - Upload de scans
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await isAuthenticatedAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    
    // Note: Dans une vraie implémentation, il faudrait gérer l'upload de fichiers
    // Ici on simule avec des URLs
    const formData = await request.formData();
    const files = formData.getAll('scans') as File[];

    if (files.length === 0) {
      return NextResponse.json({ 
        message: 'Aucun fichier fourni' 
      }, { status: 400 });
    }

    // Simuler l'upload et créer les entrées en BDD
    const scans = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Dans une vraie implémentation, uploader vers S3/Cloudinary/etc.
      // Ici on crée juste une entrée simulée
      const scan = await prisma.compositionScan.create({
        data: {
          submissionId: id,
          url: `/uploads/scans/${id}/${file.name}`, // URL simulée
          pageNumber: i + 1,
          fileName: file.name,
          fileSize: file.size,
          uploadedBy: adminId,
        }
      });
      
      scans.push(scan);
    }

    return NextResponse.json({
      message: 'Scans uploadés avec succès',
      scans
    });

  } catch (error: any) {
    console.error('Erreur upload scans:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de l\'upload des scans' 
    }, { status: 500 });
  }
}

// DELETE /api/admin/submissions/[id]/scans/[scanId] - Supprimer un scan
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; scanId: string }> }
) {
  try {
    const adminId = await isAuthenticatedAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id, scanId } = await params;

    await prisma.compositionScan.delete({
      where: { 
        id: scanId,
        submissionId: id
      }
    });

    return NextResponse.json({ message: 'Scan supprimé' });

  } catch (error: any) {
    console.error('Erreur suppression scan:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la suppression du scan' 
    }, { status: 500 });
  }
}
