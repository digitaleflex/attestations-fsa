"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Trash2, ExternalLink, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["user-notifications", filter],
    queryFn: async () => {
      const res = await fetch(`/api/user/notifications?limit=100&${filter === "unread" ? "unread=true" : ""}`);
      if (!res.ok) return { notifications: [], unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "ATTESTATION_VALIDATED": return "Attestation validée";
      case "ATTESTATION_REJECTED": return "Attestation rejetée";
      case "EXAM_RESULT_PUBLISHED": return "Résultat publié";
      case "INTERNSHIP_ACCEPTED": return "Stage accepté";
      case "INTERNSHIP_REJECTED": return "Stage rejeté";
      case "CORRECTION_APPROVED": return "Correction approuvée";
      case "CORRECTION_REJECTED": return "Correction rejetée";
      case "SUPPORT_REPLY": return "Réponse du support";
      default: return "Information";
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
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      await markReadMutation.mutateAsync(notif.id);
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <Card className="p-8 bg-gradient-to-br from-blue-900 to-slate-900 text-white shadow-2xl relative overflow-hidden border-none">
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-none px-3 py-1 text-[10px] uppercase font-black tracking-widest mb-2">
              Centre de notifications
            </Badge>
            <div className="flex items-center gap-3">
              <Bell className="w-8 h-8 text-emerald-400" />
              <h2 className="text-3xl font-black tracking-tighter">Notifications</h2>
            </div>
            <p className="text-blue-100/70 font-medium">
              {unreadCount > 0
                ? `Vous avez ${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
                : "Toutes vos notifications sont à jour"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllReadMutation.mutate()}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/20 rounded-xl px-6 font-bold gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Tout marquer comme lu
            </Button>
          )}
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4 bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Filtres</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className={filter === "all" ? "bg-slate-900" : ""}
          >
            Toutes ({data?.notifications?.length || 0})
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unread")}
            className={filter === "unread" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            Non lues ({unreadCount})
          </Button>
        </div>
      </Card>

      {/* Notifications List */}
      {!notifications.length ? (
        <Card className="p-12 bg-white shadow-sm">
          <div className="text-center">
            <Bell className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-lg font-bold text-slate-600">Aucune notification</p>
            <p className="text-sm text-slate-400 mt-1">
              Vous serez notifié des mises à jour importantes concernant vos attestations, examens et stages.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif: any) => (
            <Card
              key={notif.id}
              className={`p-5 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer border-l-4 ${
                !notif.isRead
                  ? "border-l-emerald-500 bg-emerald-50/20"
                  : "border-l-slate-200"
              }`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl flex-shrink-0 mt-0.5">{getTypeIcon(notif.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm ${!notif.isRead ? "font-bold text-slate-800" : "font-semibold text-slate-700"}`}>
                      {notif.title}
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {getTypeLabel(notif.type)}
                    </Badge>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{notif.message}</p>
                  <p className="text-xs text-slate-400 font-medium mt-2">{formatRelativeTime(notif.createdAt)}</p>
                </div>
                {notif.link && (
                  <ExternalLink className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
