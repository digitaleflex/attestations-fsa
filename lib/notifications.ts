import { prisma } from '@/lib/prisma';
import { NotificationType } from '@prisma/client';

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
};

/**
 * Crée une notification pour un utilisateur
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link || null,
        metadata: input.metadata || null,
      },
    });
  } catch (error) {
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
