"use client";
import React, { useState, useEffect } from "react";
import {
  Bell,
  AlertTriangle,
  FileCheck,
  Check,
  Info,
  MessageSquare as ChatIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { getPusherClient } from "@/lib/pusher";
import { toast } from "sonner";

interface BaseNotification {
  id: string;
  createdAt: string;
  status: string;
}

interface ReportNotification extends BaseNotification {
  motif: string;
}

interface CorrectionNotification extends BaseNotification {
  field: string;
  user: { name: string | null };
}

interface ChatNotification extends BaseNotification {
  content: string;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: reports = [] } = useQuery<ReportNotification[]>({
    queryKey: ["admin-notifications-reports"],
    queryFn: async () => {
      const res = await fetch("/api/signalement");
      const data = await res.json();
      return Array.isArray(data) ? data.filter((r) => r.status === "NOUVEAU") : [];
    },
    refetchInterval: 30000,
  });

  const { data: corrections = [] } = useQuery<CorrectionNotification[]>({
    queryKey: ["admin-notifications-corrections"],
    queryFn: async () => {
      const res = await fetch("/api/admin/corrections");
      const data = await res.json();
      return Array.isArray(data) ? data.filter((c) => c.status === "PENDING") : [];
    },
    refetchInterval: 45000,
  });

  const { data: messages = [] } = useQuery<ChatNotification[]>({
    queryKey: ["admin-notifications-messages"],
    queryFn: async () => {
      const res = await fetch("/api/chat?unread=true");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 60000,
  });

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe("admin-events");

    const refresh = (type: string, data: { content?: string; motif?: string; userName?: string }) => {
        queryClient.invalidateQueries({ queryKey: ["admin-notifications-reports"] });
        queryClient.invalidateQueries({ queryKey: ["admin-notifications-corrections"] });
        queryClient.invalidateQueries({ queryKey: ["admin-notifications-messages"] });

        toast.info(type === "message" ? "Nouveau Message" : type === "report" ? "Nouveau Signalement" : "Demande de Correction", {
            description: data.content || data.motif || data.userName || "Action requise",
        });
    };

    channel.bind("message", (data: { content?: string }) => refresh("message", data));
    channel.bind("report", (data: { motif?: string }) => refresh("report", data));
    channel.bind("correction", (data: { userName?: string }) => refresh("correction", data));

    return () => {
      pusher.unsubscribe("admin-events");
    };
  }, [queryClient]);

  const allNotifications = [
    ...reports.map((r) => ({
        id: r.id,
        type: "REPORT",
        title: "Nouveau Signalement",
        message: r.motif,
        time: new Date(r.createdAt),
        link: `/admin/signalements`,
        icon: AlertTriangle,
        iconClass: "text-amber-500 bg-amber-50"
    })),
    ...corrections.map((c) => ({
        id: c.id,
        type: "CORRECTION",
        title: "Demande de Correction",
        message: `${c.user?.name} souhaite modifier ${c.field}`,
        time: new Date(c.createdAt),
        link: `/admin/corrections`,
        icon: FileCheck,
        iconClass: "text-blue-500 bg-blue-50"
    })),
    ...messages.map((m) => ({
        id: m.id,
        type: "MESSAGE",
        title: "Nouveau Message",
        message: m.content,
        time: new Date(m.createdAt),
        link: `/admin/messages`,
        icon: ChatIcon,
        iconClass: "text-emerald-500 bg-emerald-50"
    }))
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  const unreadCount = allNotifications.length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80 md:w-96 bg-white shadow-2xl border-slate-100 rounded-2xl p-0 overflow-hidden" align="end">
        <DropdownMenuLabel className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm tracking-tight">Centre de Notifications</h3>
          </div>
          {unreadCount > 0 && (
            <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-[10px]">
              {unreadCount} nouvelles
            </Badge>
          )}
        </DropdownMenuLabel>

        <div className="max-h-[400px] overflow-y-auto scrollbar-hide py-2">
            {allNotifications.length === 0 ? (
                <div className="py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Check className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">Tout est à jour !</p>
                    <p className="text-xs text-slate-400 mt-1">Aucune nouvelle alerte pour le moment.</p>
                </div>
            ) : (
                allNotifications.map((notif) => (
                    <Link key={`${notif.type}-${notif.id}`} href={notif.link} onClick={() => setIsOpen(false)}>
                        <div className="px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none flex items-start gap-3 group">
                            <div className={`p-2 rounded-xl shrink-0 transition-transform group-hover:scale-110 ${notif.iconClass}`}>
                                <notif.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-900 mb-0.5">{notif.title}</p>
                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{notif.message}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1.5 flex items-center gap-1.5">
                                    <ClockIcon className="w-2.5 h-2.5" />
                                    {formatDistanceToNow(notif.time, { addSuffix: true, locale: fr })}
                                </p>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Link>
                ))
            )}
        </div>

        {allNotifications.length > 0 && (
            <div className="p-3 bg-slate-50 border-t border-slate-100">
                <Link href="/admin/signalements" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" className="w-full text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-2">
                        <Info className="w-3 h-3" />
                        Voir tous les signalements
                    </Button>
                </Link>
            </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
