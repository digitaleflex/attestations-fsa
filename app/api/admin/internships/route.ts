import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { DEFAULT_READ_URL_TTL_SECONDS, getStorage } from '@/lib/storage';

export async function GET(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const requests = await prisma.internshipRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // #260 : l'URL de lecture du CV est régénérée à la demande (courte durée)
    // et n'est jamais persistée. Les demandes historiques sans `cvKey`
    // conservent leur `cvUrl` inchangé.
    const withCvUrl = await Promise.all(requests.map(async (request) => {
      if (!request.cvKey) return request;
      try {
        const url = await getStorage().getSignedUrl(request.cvKey, DEFAULT_READ_URL_TTL_SECONDS);
        return { ...request, cvUrl: url };
      } catch {
        return { ...request, cvUrl: null };
      }
    }));
    return NextResponse.json(withCvUrl);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ message: "ID and Status required" }, { status: 400 });
    }

    const oldRequest = await prisma.internshipRequest.findUnique({
      where: { id },
      select: { status: true, userId: true, fullName: true, position: true },
    });

    const updated = await prisma.internshipRequest.update({
      where: { id },
      data: { status }
    });

    // Créer une notification si le statut a changé et qu'un userId existe
    if (oldRequest?.userId && oldRequest.status !== status) {
      if (status === 'ACCEPTED') {
        await createNotification({
          userId: oldRequest.userId,
          type: 'INTERNSHIP_ACCEPTED',
          title: 'Demande de stage acceptée ! 🎯',
          message: `Votre demande de stage pour le poste "${oldRequest.position}" a été acceptée.`,
          link: `/internships`,
        });
      } else if (status === 'REJECTED') {
        await createNotification({
          userId: oldRequest.userId,
          type: 'INTERNSHIP_REJECTED',
          title: 'Demande de stage rejetée',
          message: `Votre demande de stage pour le poste "${oldRequest.position}" a été rejetée. Contactez le support pour plus d'informations.`,
          link: `/internships`,
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ message: "Erreur" }, { status: 500 });
  }
}
