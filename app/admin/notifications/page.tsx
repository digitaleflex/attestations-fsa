"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Send, 
  Users, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Megaphone,
  Target,
  Info
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [formationId, setFormationId] = useState("all");
  const [sendEmail, setSendEmail] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { data: formations } = useQuery({
    queryKey: ["formations"],
    queryFn: () => apiFetch("/api/formations") as any,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsSending(true);
    try {
      const res = await apiFetch("/api/admin/notifications/bulk", {
        method: "POST",
        body: JSON.stringify({
          title,
          message,
          formationId,
          sendEmail
        })
      }) as any;

      toast.success(res.message || "Notification envoyée !");
      setTitle("");
      setMessage("");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'envoi");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-200">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Communication Groupée</h1>
            <p className="text-slate-500">Envoyez des annonces massives à vos candidats</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <Card className="lg:col-span-2 p-8 bg-white shadow-xl border-none ring-1 ring-slate-200 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Send className="w-32 h-32 text-slate-900" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-bold text-slate-700">Titre de l'annonce</Label>
                <Input
                  id="title"
                  placeholder="Ex: Ouverture des inscriptions pour la session de Mai"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-12 border-slate-200 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-bold text-slate-700">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Rédigez votre message ici..."
                  className="min-h-[200px] border-slate-200 focus:ring-red-500 resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p className="text-xs text-slate-400 italic">Ce message apparaîtra sur le tableau de bord de chaque candidat sélectionné.</p>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-2">
                   <input 
                    type="checkbox" 
                    id="sendEmail" 
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500" 
                  />
                  <Label htmlFor="sendEmail" className="text-sm font-medium text-slate-600 cursor-pointer">
                    Doubler par Email (Confirmation d'inscription)
                  </Label>
                </div>

                <Button 
                  disabled={isSending}
                  className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-8 h-12 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95 gap-2"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  Diffuser l'annonce
                </Button>
              </div>
            </form>
          </Card>

          {/* Sidebar / Settings */}
          <div className="space-y-6">
            <Card className="p-6 bg-white shadow-lg border-none ring-1 ring-slate-200">
              <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold">
                <Target className="w-5 h-5 text-red-500" />
                Ciblage
              </div>
              
              <div className="space-y-4">
                <div 
                  onClick={() => setFormationId("all")}
                  className={cn(
                    "p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3",
                    formationId === "all" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-100 hover:border-slate-200 text-slate-600"
                  )}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-semibold">Tous les candidats</span>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold pl-1">Ou par formation</p>
                  <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {formations?.map((f: any) => (
                      <div 
                        key={f.id}
                        onClick={() => setFormationId(f.id)}
                        className={cn(
                          "p-2.5 rounded-lg border text-xs cursor-pointer transition-all",
                          formationId === f.id ? "border-red-400 bg-red-50 text-red-800" : "border-slate-100 hover:bg-slate-50 text-slate-600"
                        )}
                      >
                        {f.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900 border-none shadow-lg text-white">
              <div className="flex items-center gap-2 mb-3 text-amber-400 font-bold">
                <Info className="w-5 h-5" />
                Conseil Admin
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Les notifications groupées sont un outil puissant. Pour un impact maximum :
              </p>
              <ul className="mt-3 space-y-2 text-[11px] text-slate-400">
                <li className="flex gap-2">
                  <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  Soyez concis et clair dans vos titres.
                </li>
                <li className="flex gap-2">
                  <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  Utilisez l'option email uniquement pour les annonces CRITIQUES.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
