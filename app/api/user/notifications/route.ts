import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pusherServer } from '@/lib/pusher';
import { getCurrentUser, getAdminUser } from '@/lib/auth';

// GET /api/user/notifications - Récupérer les notifications de l'utilisateur
export async function GET(request: Request) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = userSession.id;

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const onlyUnread = url.searchParams.get('unread') === 'true';

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(onlyUnread ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: unknown) {
    console.error('Erreur notifications:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/user/notifications - Marquer comme lu(es)
export async function PATCH(request: Request) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = userSession.id;

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ message: 'Toutes les notifications marquées comme lues' });
    }

    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId, userId },
        data: { isRead: true },
      });
      return NextResponse.json({ message: 'Notification marquée comme lue' });
    }

    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Erreur update notification:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/user/notifications - Créer une notification (usage interne/admin)
export async function POST(request: Request) {
  try {
    // 🔒 SECURITÉ: Seul un administrateur peut créer des notifications pour d'autres
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, type, title, message, link, metadata } = body;

    if (!userId || !type || !title || !message) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
        metadata: metadata || null,
      },
    });

    // Déclencher l'événement temps réel Pusher pour les notifications
    try {
      if (process.env.PUSHER_APP_ID) {
        await pusherServer.trigger(`user-${userId}`, "notification", notification);
      }
    } catch (pusherError) {
      console.error("Erreur Pusher Notification:", pusherError);
    }

    return NextResponse.json(notification);
  } catch (error: unknown) {
    console.error('Erreur création notification:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
