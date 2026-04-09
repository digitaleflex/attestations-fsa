import PusherServer from "pusher";
import PusherClient from "pusher-js";

/**
 * Configuration Pusher pour le serveur
 */
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

/**
 * Configuration Pusher pour le client
 */
let pusherClientInstance: any = null;

export const getPusherClient = () => {
  if (!pusherClientInstance && typeof window !== 'undefined') {
    pusherClientInstance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return pusherClientInstance;
};
