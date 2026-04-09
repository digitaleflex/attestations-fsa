"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  CheckCircle2, 
  Circle, 
  Send, 
  Clock, 
  ChevronRight,
  ShieldCheck,
  LayoutDashboard,
  Rocket,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PortfolioMissionsPage() {
  const queryClient = useQueryClient();
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [submission, setSubmission] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["portfolio-status"],
    queryFn: async () => {
      const res = await fetch("/api/user/portfolio/status");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    }
  });

  const submitMissionMutation = useMutation({
    mutationFn: async ({ missionId, proof }: { missionId: string, proof: string }) => {
      const res = await fetch(`/api/user/portfolio/missions/${missionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof }),
      });
      if (!res.ok) throw new Error("Erreur lors de la soumission");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-status"] });
      setSelectedMission(null);
      setSubmission("");
      toast.success("Mission soumise avec succès !");
    }
  });

  const requestValidationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/portfolio/validate", { method: "POST" });
      if (!res.ok) throw new Error("Impossible de demander la validation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-status"] });
      toast.success("Demande de validation envoyée à l'administration !");
    }
  });

  if (isLoading) return <div className="p-20 text-center">Chargement de vos missions...</div>;

  const missions = data?.missions || [];
  const portfolioStatus = data?.status || "DRAFT";
  const completedCount = missions.filter((m: any) => m.userStatus === "COMPLETED").length;
  const totalCount = missions.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header Statistique */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="md:col-span-2 p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border-none shadow-2xl relative overflow-hidden rounded-[2.5rem]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -z-0" />
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
               <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/20">
                  <Trophy className="w-12 h-12 text-emerald-400" />
               </div>
               <div className="flex-1 space-y-2 text-center md:text-left">
                  <h1 className="text-3xl font-black tracking-tight">Votre Parcours Portfolio</h1>
                  <p className="text-slate-400 font-medium text-sm">Complétez toutes vos missions pour faire valider votre vitrine professionnelle par FSA.</p>
                  <div className="pt-4 flex items-center gap-4">
                     <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                     </div>
                     <span className="text-xs font-black text-emerald-400">{Math.round(progress)}%</span>
                  </div>
               </div>
            </div>
         </Card>

         <Card className="p-8 border-none shadow-xl bg-white rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">État de votre Vitrine</p>
            <StatusBadge status={portfolioStatus} />
            {progress === 100 && portfolioStatus === "DRAFT" && (
               <Button onClick={() => requestValidationMutation.mutate()} className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 rounded-xl font-bold py-6 gap-2">
                  <Rocket className="w-4 h-4" /> Publier mon site
               </Button>
            )}
            {portfolioStatus === "PUBLISHED" && (
               <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 uppercase tracking-tighter">
                  Félicitations ! Votre site est en ligne.
               </p>
            )}
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Liste des Missions */}
         <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-black text-slate-900 px-2 flex items-center gap-2">
               <LayoutDashboard className="w-5 h-5 text-indigo-600" /> Vos Missions de Validation
            </h2>
            {missions.map((mission: any, idx: number) => (
               <Card 
                  key={mission.id} 
                  className={`p-6 border-none shadow-premium transition-all cursor-pointer group ${selectedMission?.id === mission.id ? 'ring-2 ring-indigo-500 scale-[1.02]' : 'hover:scale-[1.01] bg-white'}`}
                  onClick={() => setSelectedMission(mission)}
               >
                  <div className="flex items-center gap-6">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${mission.userStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {mission.userStatus === 'COMPLETED' ? <CheckCircle2 className="w-6 h-6" /> : (idx + 1)}
                     </div>
                     <div className="flex-1">
                        <div className="flex items-center gap-2">
                           <h3 className="font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{mission.title}</h3>
                           {mission.formationName && <Badge className="bg-slate-50 text-slate-400 border-none px-2 py-0 h-4 text-[8px] uppercase tracking-tighter">{mission.formationName}</Badge>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{mission.description}</p>
                     </div>
                     <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </div>
               </Card>
            ))}
         </div>

         {/* Détail de la Mission Sélectionnée */}
         <div className="space-y-4">
            {selectedMission ? (
               <Card className="p-8 border-none shadow-2xl bg-white rounded-[2.5rem] sticky top-24 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between mb-6">
                     <Badge className="bg-indigo-50 text-indigo-700 border-none px-3 py-1 font-black text-[10px] uppercase tracking-tighter">Mission Active</Badge>
                     <Button variant="ghost" size="sm" onClick={() => setSelectedMission(null)} className="text-slate-400 h-8">Fermer</Button>
                  </div>
                  
                  <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight mb-4">{selectedMission.title}</h3>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed mb-8">
                     {selectedMission.description}
                  </div>

                  {selectedMission.userStatus === 'COMPLETED' ? (
                     <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center space-y-3">
                        <div className="w-12 h-12 bg-white rounded-xl mx-auto flex items-center justify-center text-emerald-500 shadow-sm">
                           <ShieldCheck className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-emerald-700">Mission Validée</p>
                        <p className="text-[10px] text-emerald-600/70 font-medium">Félicitations ! Vous avez complété ce défi avec succès.</p>
                     </div>
                  ) : (
                     <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Preuve de réalisation</label>
                           <Textarea 
                              placeholder="Décrivez votre travail ou collez un lien vers votre preuve (Google Drive, PDF, etc.)"
                              className="min-h-[120px] rounded-2xl border-slate-200 focus:ring-indigo-500 text-sm p-4"
                              value={submission}
                              onChange={(e) => setSubmission(e.target.value)}
                           />
                        </div>
                        <Button 
                           onClick={() => submitMissionMutation.mutate({ missionId: selectedMission.id, proof: submission })}
                           disabled={!submission || submitMissionMutation.isPending}
                           className="w-full h-14 bg-slate-900 hover:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200 font-bold gap-3"
                        >
                           {submitMissionMutation.isPending ? "Envoi..." : <><Send className="w-4 h-4" /> Soumettre mon travail</>}
                        </Button>
                     </div>
                  )}

                  {selectedMission.adminComment && (
                    <div className="mt-8 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                       <p className="text-[10px] font-black uppercase text-rose-500 mb-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Retour de l'administration
                       </p>
                       <p className="text-xs text-rose-700 font-medium">{selectedMission.adminComment}</p>
                    </div>
                  )}
               </Card>
            ) : (
               <div className="h-96 w-full rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center p-8 opacity-50">
                  <Circle className="w-12 h-12 text-slate-200 mb-4" />
                  <p className="text-sm text-slate-400 font-bold">Sélectionnez une mission pour commencer</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    DRAFT: { label: "En cours", color: "bg-slate-100 text-slate-600", icon: Circle },
    PENDING_VALIDATION: { label: "En attente validation", color: "bg-amber-100 text-amber-700", icon: Clock },
    PUBLISHED: { label: "En ligne / Public", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    REJECTED: { label: "Révisions nécessaires", color: "bg-rose-100 text-rose-700", icon: AlertCircle },
  };

  const config = configs[status] || configs.DRAFT;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-5 py-2 rounded-2xl border border-transparent font-black text-xs uppercase tracking-tighter ${config.color}`}>
       <Icon className="w-4 h-4" />
       {config.label}
    </div>
  );
}
