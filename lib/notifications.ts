import { prisma } from '@/lib/prisma';
import { NotificationType, Prisma } from '@prisma/client';

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

/**
 * Notifie tous les admins
 */
export async function notifyAllAdmins(input: Omit<CreateNotificationInput, 'userId'>) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { equals: 'admin', mode: 'insensitive' } },
      select: { id: true },
    });

    if (admins.length === 0) return [];

    const results = await Promise.all(
      admins.map(admin =>
        createNotification({ ...input, userId: admin.id })
      )
    );

    return results.filter(Boolean);
  } catch (error: unknown) {
    console.error('[NOTIFY_ADMINS ERROR]', error);
    return [];
  }
}
