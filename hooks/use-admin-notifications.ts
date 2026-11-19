"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import Pusher from "pusher-js";

const ADMIN_CHANNEL = "private-admin";

/**
 * Écoute les événements temps réel Pusher sur le canal admin et affiche
 * une toast notification (via sonner) pour les nouveaux utilisateurs et les
 * actions importantes.
 */
export function useAdminNotifications() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    // Pas de config Pusher côté client : on désactive silencieusement.
    if (!key || !cluster) return;

    let pusher: Pusher | null = null;
    let channel: ReturnType<Pusher["subscribe"]> | null = null;

    try {
      pusher = new Pusher(key, {
        cluster,
        authEndpoint: "/api/pusher/auth",
        authTransport: "ajax",
      });

      channel = pusher.subscribe(ADMIN_CHANNEL);

      const handleEvent = (eventName: string, data: any) => {
        const message =
          (data && (data.message || data.title || data.description)) ||
          "Nouvelle activité détectée";

        const lower = String(eventName || "").toLowerCase();

        if (
          lower.includes("user") ||
          lower.includes("register") ||
          lower.includes("signup") ||
          lower.includes("inscription")
        ) {
          toast.success("Nouvel utilisateur inscrit", {
            description: message,
          });
          return;
        }

        if (
          lower.includes("important") ||
          lower.includes("action") ||
          lower.includes("alert")
        ) {
          toast.warning("Action importante", {
            description: message,
          });
          return;
        }

        toast.info(message);
      };

      channel.bind_global((eventName: string, data: any) => {
        // Ignorer les événements internes de Pusher (pusher:*)
        if (String(eventName || "").startsWith("pusher:")) return;
        handleEvent(eventName, data);
      });
    } catch (error) {
      console.error("[useAdminNotifications] Pusher init failed:", error);
    }

    return () => {
      try {
        if (channel) {
          channel.unbind_all();
          channel.unbind_global();
        }
        if (pusher) {
          pusher.unsubscribe(ADMIN_CHANNEL);
          pusher.disconnect();
        }
      } catch {
        // no-op
      }
    };
  }, []);
}

export default useAdminNotifications;