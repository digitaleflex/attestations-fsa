import { prisma } from '@/lib/prisma';
import { NotificationType, Prisma } from '@prisma/client';
import { pusherServer } from '@/lib/pusher';

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Crée une notification pour un utilisateur
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link || undefined,
        metadata: input.metadata || undefined,
      },
    });

    // Déclencher l'événement Pusher pour la mise à jour temps réel
    await pusherServer.trigger(`user-${input.userId}`, 'notification', notification);

    return notification;
  } catch (error: unknown) {
    console.error('[NOTIFICATION ERROR]', error);
    return null;
  }
}

/**
 * Crée des notifications en lot
 */
export async function createNotificationsBatch(inputs: CreateNotificationInput[]) {
  const results = await Promise.all(inputs.map(input => createNotification(input)));
  return results.filter(Boolean);
}
