"use client";

import { useEffect } from "react";
import { getPusherClient } from "@/lib/pusher";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileText } from "lucide-react";
import React from "react";

export default function PusherAdminListener() {
  const router = useRouter();

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe("admin-updates");

    channel.bind("new-submission", (data: any) => {
      toast("Nouvelle soumission reçue ! 📝", {
        description: `${data.candidateName} vient de terminer son examen.`,
        action: {
          label: "Corriger",
          onClick: () => router.push(`/admin/submissions/${data.examId}`)
        },
        duration: 8000,
        icon: React.createElement(ClipboardCheck, { className: "w-5 h-5 text-indigo-500" })
      });
    });

    channel.bind("new-proof", (data: any) => {
        toast("Nouveau livrable déposé ! 📄", {
          description: `${data.candidateName} a ajouté une preuve : ${data.label}`,
          action: {
            label: "Voir",
            onClick: () => router.push(`/admin/portfolios`)
          },
          duration: 8000,
          icon: React.createElement(FileText, { className: "w-5 h-5 text-emerald-500" })
        });
      });

    return () => {
      pusher.unsubscribe("admin-updates");
    };
  }, [router]);

  return null;
}
