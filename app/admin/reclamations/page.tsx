"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  User as UserIcon, 
  BookOpen, 
  Send,
  Loader2,
  Filter
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { User } from "@/types";

interface Reclamation {
  id: string;
  userId: string;
  submissionId: string | null;
  subject: string;
  message: string;
  status: "PENDING" | "RESOLVED";
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  submission?: {
    id: string;
    exam?: {
      title: string;
    };
  };
}

export default function AdminReclamationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("PENDING");
  const [replies, setReplies] = useState<Record<string, string>>({});

  const { data: reclamations, isLoading } = useQuery({
    queryKey: ["admin-reclamations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reclamations");
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<Reclamation[]>;
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, status, adminReply }: { id: string; status: "PENDING" | "RESOLVED"; adminReply: string | null }) => {
      const res = await fetch(`/api/admin/reclamations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, adminReply }),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reclamations"] });
      toast.success("Réponse envoyée avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de l'envoi");
    }
  });

  const filtered = reclamations?.filter((r: Reclamation) => filter === "all" || r.status === filter) || [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Chargement des réclamations...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Badge className="bg-rose-500 text-white border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            Centre de Litiges
          </Badge>
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl">
               <MessageSquare className="w-6 h-6 text-emerald-400" />
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Réclamations Candidats</h1>
          </div>
          <p className="text-slate-500 font-medium">Gérez les contestations de notes et les demandes de révision.</p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
          {["PENDING", "RESOLVED", "all"].map((f) => (
            <Button
              key={f}
              variant="ghost"
              size="sm"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-xl px-6 font-black text-[10px] uppercase tracking-widest h-10 transition-all",
                filter === f ? "bg-white text-slate-900 shadow-md" : "text-slate-500"
              )}
            >
              {f === "PENDING" ? "À traiter" : f === "RESOLVED" ? "Clôturées" : "Toutes"}
            </Button>
          ))}
        </div>
      </header>

      <div className="grid gap-6">
        {filtered.length === 0 ? (
          <Card className="p-20 text-center border-dashed border-2 bg-slate-50/50">
             <MessageSquare className="w-16 h-16 text-slate-200 mx-auto mb-4" />
             <h3 className="text-xl font-bold text-slate-400">Aucune réclamation dans cette catégorie</h3>
          </Card>
        ) : (
          filtered.map((reclamation: Reclamation) => (
            <Card key={reclamation.id} className="p-4 sm:p-8 border-none shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all rounded-[32px] bg-white group overflow-hidden relative">
              <div className={cn(
                "absolute top-0 left-0 w-2 h-full",
                reclamation.status === 'PENDING' ? "bg-amber-400" : "bg-emerald-500"
              )} />
              
              <div className="grid lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Badge variant="outline" className="border-slate-200 text-slate-500 text-[9px] font-black uppercase">
                        Sujet: {reclamation.subject}
                      </Badge>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight mt-2">{reclamation.submission?.exam?.title}</h3>
                    </div>
                    <Badge className={cn(
                      "font-black text-[10px] uppercase px-3 py-1 border-none tracking-widest",
                      reclamation.status === 'PENDING' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {reclamation.status === 'PENDING' ? "En attente" : "Traité"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                      <UserIcon className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase">{reclamation.user?.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold">{reclamation.user?.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Message du candidat</p>
                    <div className="p-6 bg-slate-900 text-slate-300 rounded-3xl italic leading-relaxed text-sm shadow-inner">
                      "{reclamation.message}"
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 p-2 px-4 rounded-xl w-fit">
                    <Clock className="w-3 h-3" />
                    Soumis le {new Date(reclamation.createdAt).toLocaleDateString("fr-FR", { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="flex flex-col h-full bg-slate-50/50 rounded-[28px] p-4 sm:p-8 border border-white shadow-inner">
                  <div className="flex items-center gap-2 mb-6">
                    <Send className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-800">Action Corrective</span>
                  </div>

                  {reclamation.status === 'RESOLVED' ? (
                    <div className="space-y-4 flex-1 flex flex-col justify-center text-center">
                       <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                       <div>
                          <p className="text-emerald-700 font-black uppercase text-sm">Réclamation Clôturée</p>
                          <p className="text-xs text-slate-500 mt-2 font-medium">Réponse envoyée :</p>
                          <p className="text-slate-800 text-sm mt-4 p-4 bg-white rounded-2xl border border-slate-200 font-medium italic">
                            "{reclamation.adminReply}"
                          </p>
                       </div>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="mt-4 text-[10px] font-black uppercase border"
                         onClick={() => replyMutation.mutate({ id: reclamation.id, status: 'PENDING', adminReply: reclamation.adminReply })}
                       >
                         Réouvrir le ticket
                       </Button>
                    </div>
                  ) : (
                    <div className="space-y-6 flex flex-col h-full">
                      <div className="space-y-2 flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Réponse à l'élève</label>
                        <Textarea 
                          placeholder="Expliquez la décision ou annoncez une modification de note..."
                          className="min-h-[150px] bg-white border-2 border-slate-200 rounded-2xl text-sm font-medium focus:border-emerald-500 transition-colors"
                          value={replies[reclamation.id] || ""}
                          onChange={(e) => setReplies({ ...replies, [reclamation.id]: e.target.value })}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button 
                          onClick={() => replyMutation.mutate({ id: reclamation.id, status: 'RESOLVED', adminReply: replies[reclamation.id] })}
                          disabled={!replies[reclamation.id] || replyMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] h-12 rounded-xl gap-2 shadow-lg shadow-emerald-200"
                        >
                          <CheckCircle className="w-4 h-4" /> Accepter / Valider
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => replyMutation.mutate({ id: reclamation.id, status: 'RESOLVED', adminReply: replies[reclamation.id] || "Votre demande a été examinée. La note initiale est maintenue." })}
                          disabled={replyMutation.isPending}
                          className="border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl gap-2 bg-white"
                        >
                          <XCircle className="w-4 h-4" /> Rejeter
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
