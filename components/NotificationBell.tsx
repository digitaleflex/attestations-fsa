"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { toast } from "sonner";

export default function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ["user-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/user/notifications?limit=10");
      if (!res.ok) return { notifications: [], unreadCount: 0 };
      const data = await res.json();
      
      // On déclenche l'écouteur Pusher une fois qu'on a le userId des notifs
      if (data.notifications?.length > 0 || data.unreadCount >= 0) {
          // Note: on pourrait aussi récupérer le userId via une API de profil
      }
      return data;
    },
    refetchInterval: 30000, // On réduit le polling car on a Pusher
    staleTime: 10000,
  });

  // Écouteur Pusher pour notifications temps réel
  useEffect(() => {
    // On essaie de récupérer le userId via les cookies ou les données fetchées
    // Pour simplifier ici, on va fetch le profil si besoin, ou utiliser le premier message
    const setupPusher = async () => {
        const profilRes = await fetch("/api/user/profile");
        const profil = await profilRes.json();
        
        if (profil?.id) {
            const pusher = getPusherClient();
            const channel = pusher.subscribe(`user-${profil.id}`);
            
            channel.bind("notification", (newNotif: any) => {
                queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
                toast.success(newNotif.message, {
                    description: newNotif.title,
                    action: newNotif.link ? {
                        label: "Voir",
                        onClick: () => router.push(newNotif.link)
                    } : undefined
                });
            });

            return () => pusher.unsubscribe(`user-${profil.id}`);
        }
    };
    
    const cleanup = setupPusher();
    return () => {
        cleanup.then(fn => fn && fn());
    };
  }, []);

  const markReadMutation = useMutation({
    mutationFn: async (notificationId?: string) => {
      return fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifData?.unreadCount || 0;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ATTESTATION_VALIDATED": return "✅";
      case "ATTESTATION_REJECTED": return "❌";
      case "EXAM_RESULT_PUBLISHED": return "📝";
      case "INTERNSHIP_ACCEPTED": return "🎯";
      case "INTERNSHIP_REJECTED": return "🚫";
      case "CORRECTION_APPROVED": return "✏️";
      case "CORRECTION_REJECTED": return "⚠️";
      case "SUPPORT_REPLY": return "💬";
      default: return "📢";
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString("fr-FR");
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      await markReadMutation.mutateAsync(notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-white/80 hover:bg-slate-100 border border-slate-200 shadow-sm transition-all active:scale-95"
        aria-label="Notifications"
      >
        <Bell className={`w-5 h-5 transition-colors ${unreadCount > 0 ? "text-emerald-600" : "text-slate-500"}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-[380px] max-h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tout marquer
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[400px]">
            {!notifData?.notifications?.length ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Aucune notification</p>
              </div>
            ) : (
              notifData.notifications.map((notif: any) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 items-start group ${
                    !notif.isRead ? "bg-emerald-50/30" : ""
                  }`}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{getTypeIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] leading-snug ${!notif.isRead ? "font-bold text-slate-800" : "text-slate-600"}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 truncate">{notif.message}</p>
                    <p className="text-[10px] text-slate-300 font-medium mt-1">{formatRelativeTime(notif.createdAt)}</p>
                  </div>
                  {notif.link && (
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 flex-shrink-0 mt-1 transition-colors" />
                  )}
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/50">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block text-center text-xs font-semibold text-emerald-600 hover:text-emerald-700 py-3 transition-colors"
            >
              Voir toutes les notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
