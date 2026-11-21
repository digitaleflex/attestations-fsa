"use client";

import { useAdminNotifications } from "@/hooks/use-admin-notifications";

/**
 * Composant client léger qui active les notifications temps réel Pusher
 * pour l'ensemble des pages admin.
 */
export function AdminNotificationsListener() {
  useAdminNotifications();
  return null;
}

export default AdminNotificationsListener;