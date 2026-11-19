"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON() as PushSubscriptionJSON;
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }),
  });
  if (!res.ok) throw new Error("Échec de l'enregistrement de la subscription");
  return res.json();
}

export async function requestPushPermissionAndSubscribe(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return false;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKey
      ? (urlBase64ToUint8Array(vapidPublicKey) as BufferSource)
      : undefined,
  });

  await registerSubscription(subscription);
  return true;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setIsSupported(true);
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setIsSubscribed(!!sub))
        .catch(() => {});
    }
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await requestPushPermissionAndSubscribe();
      if (ok) {
        setIsSubscribed(true);
        toast.success("Notifications push activées");
      } else {
        toast.error("Permission refusée ou non supportée");
      }
      return ok;
    } catch (error) {
      console.error("[usePushNotifications] subscribe failed:", error);
      toast.error("Échec de l'activation des notifications push");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { isSupported, isSubscribed, loading, subscribe };
}

export default usePushNotifications;
