// lib/pusher.ts
// Pusher server instance for real-time notifications
import Pusher from "pusher";

/**
 * Instance Pusher côté serveur.
 * Utilisée pour déclencher des événements temps réel (notifications, mises à jour examens, etc.)
 * depuis les routes API vers les clients connectés.
 *
 * Variables d'environnement requises :
 *   PUSHER_APP_ID
 *   PUSHER_KEY
 *   PUSHER_SECRET
 *   PUSHER_CLUSTER
 */
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

/**
 * Canaux et événements standards de l'application.
 * Nommage : `private-{resource}-{id}` pour canaux privés, `presence-{resource}` pour presence.
 */
export const PusherChannels = {
  /** Notifications utilisateur : `private-user-{userId}` */
  userNotifications: (userId: string) => `private-user-${userId}`,

  /** Examens : `private-exam-{examId}` (pour mises à jour temps réel pendant l'examen) */
  exam: (examId: string) => `private-exam-${examId}`,

  /** Attestations : `private-attestation-{attestationId}` */
  attestation: (attestationId: string) => `private-attestation-${attestationId}`,

  /** Admin : canal global pour notifications admin (nouveaux signalements, etc.) */
  admin: "private-admin",
} as const;

/**
 * Événements standards
 */
export const PusherEvents = {
  /** Notification créée pour un utilisateur */
  notificationCreated: "notification:created",

  /** Examen démarré / soumis / corrigé */
  examStarted: "exam:started",
  examSubmitted: "exam:submitted",
  examGraded: "exam:graded",

  /** Attestation émise / révoquée / réclamée */
  attestationIssued: "attestation:issued",
  attestationRevoked: "attestation:revoked",
  attestationClaimed: "attestation:claimed",

  /** Correction demandée / traitée */
  correctionRequested: "correction:requested",
  correctionResolved: "correction:resolved",
} as const;

/**
 * Helper pour déclencher une notification utilisateur.
 * Appelé depuis les routes API après création de la notification en base.
 */
export async function triggerUserNotification(
  userId: string,
  event: string,
  data: Record<string, unknown>
) {
  await pusherServer.trigger(PusherChannels.userNotifications(userId), event, data);
}

/**
 * Helper pour déclencher un événement admin.
 */
export async function triggerAdminEvent(event: string, data: Record<string, unknown>) {
  await pusherServer.trigger(PusherChannels.admin, event, data);
}

/**
 * Vérifie que la config Pusher est complète (utile au démarrage / health check).
 */
export function getPusherConfigStatus(): { configured: boolean; missing: string[] } {
  const required = ["PUSHER_APP_ID", "PUSHER_KEY", "PUSHER_SECRET", "PUSHER_CLUSTER"];
  const missing = required.filter((key) => !process.env[key]);
  return { configured: missing.length === 0, missing };
}