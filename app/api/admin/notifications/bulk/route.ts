import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import { emailService } from '@/lib/email';
import { createNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { formationId, title, message, sendEmail } = await request.json();

    if (!title || !message) {
      return NextResponse.json({ error: "Le titre et le message sont obligatoires" }, { status: 400 });
    }

    // Trouver les utilisateurs cibles
    const where: any = {};
    if (formationId && formationId !== 'all') {
      where.formationId = formationId;
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true }
    });

    if (users.length === 0) {
      return NextResponse.json({ error: "Aucun candidat trouvé pour cette sélection" }, { status: 404 });
    }

    // Notifications en base
    const notificationPromises = users.map((user: any) => 
      createNotification({
        userId: user.id,
        type: 'GENERAL',
        title,
        message,
        link: '/dashboard'
      })
    );

    // Emails (optionnel pour éviter de saturer le quota si beaucoup de monde)
    const emailPromises = sendEmail ? users.map((user: any) => 
      emailService.sendWaitlistConfirmation(user.email) 
    ) : [];

    await Promise.all([...notificationPromises, ...emailPromises]);

    return NextResponse.json({ 
        success: true, 
        count: users.length,
        message: `Notification envoyée avec succès à ${users.length} candidats.` 
    });

  } catch (error) {
    console.error("Bulk Notification Error:", error);
    return NextResponse.json({ error: "Erreur lors de l'envoi groupé" }, { status: 500 });
  }
}
