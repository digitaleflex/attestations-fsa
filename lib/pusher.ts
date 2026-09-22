import PusherServer from "pusher";
import PusherClient from "pusher-js";

/**
 * Configuration Pusher pour le serveur.
 *
 * Pusher est un service de notifications temps réel **optionnel** : sans clés
 * configurées (dev, CI, e2e), le serveur ne doit pas crasher à l'import.
 * `pusherServer` est alors un no-op qui logge un avertissement — les 5 points
 * d'appel (`trigger`) restent inchangés et résolvent sans erreur.
 */
const hasServerConfig = Boolean(
  process.env.PUSHER_APP_ID &&
    process.env.PUSHER_KEY &&
    process.env.PUSHER_SECRET &&
    process.env.PUSHER_CLUSTER,
);

const noopPusher = {
  trigger: async () => {
    console.warn("[pusher] non configuré — notification ignorée");
    return {};
  },
} as unknown as PusherServer;

export const pusherServer: PusherServer = hasServerConfig
  ? new PusherServer({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    })
  : noopPusher;

/**
 * Configuration Pusher pour le client.
 *
 * Retourne `null` quand les clés publiques sont absentes : les consommateurs
 * doivent tester le retour avant d'appeler `subscribe` (pattern déjà utilisé
 * par `PusherAdminListener`).
 */
let pusherClientInstance: any = null;

export const getPusherClient = () => {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;
  if (!pusherClientInstance && typeof window !== "undefined") {
    pusherClientInstance = new PusherClient(key, { cluster });
  }
  return pusherClientInstance;
};
