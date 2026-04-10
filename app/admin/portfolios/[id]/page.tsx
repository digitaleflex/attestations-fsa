"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  ExternalLink,
  ShieldCheck,
  FileText,
  User as UserIcon,
  Clock,
  Send,
  Loader2,
  Info,
  Trophy,
  BookOpen
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ProjectChat from "@/components/admin/ProjectChat";

export default function AdminPortfolioDetail() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});

  const { data: user, isLoading } = useQuery({
    queryKey: ["admin-portfolio", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/portfolios/${id}`);
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    }
  });

  const validateMutation = useMutation({
    mutationFn: async ({ status, missionUpdates }: { status: string, missionUpdates?: any[] }) => {
      const res = await fetch(`/api/admin/portfolios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, missionUpdates }),
      });
      if (!res.ok) throw new Error("Erreur de mise à jour");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio", id] });
      toast.success(variables.status === "PUBLISHED" ? "Portfolio publié !" : "Demande de révision envoyée");
      if (variables.status === "PUBLISHED") router.push("/admin/portfolios");
    }
  });

  if (isLoading) return <div className="p-20 text-center">Chargement...</div>;

  const handleUpdateMission = (missionId: string, status: string) => {
    validateMutation.mutate({
        status: user.portfolioStatus,
        missionUpdates: [{ id: missionId, status, adminComment: comments[missionId] || "" }]
    });
  };

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto animate-in fade-in duration-700">

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2 rounded-xl">
           <ArrowLeft className="w-4 h-4" /> Retour
        </Button>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => validateMutation.mutate({ status: "REJECTED" })}
            className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
          >
             <XCircle className="w-4 h-4 mr-2" /> Demander révisions
          </Button>
          <Button 
            onClick={() => validateMutation.mutate({ status: "PUBLISHED" })}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
          >
             <CheckCircle2 className="w-4 h-4 mr-2" /> Approuver & Publier
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <Card className="p-8 border-none shadow-premium bg-white rounded-[2rem] space-y-6">
            <div className="flex flex-col items-center text-center gap-4">
               <div className="w-24 h-24 rounded-3xl bg-slate-50 flex items-center justify-center text-3xl font-black text-purple-600 border-2 border-white shadow-xl">
                  {user.name?.charAt(0)}
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900">{user.name}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{user.email}</p>
               </div>
               <Badge className={`bg-slate-100 text-slate-600 border-none px-4 py-1 rounded-full font-black text-[10px] uppercase tracking-widest`}>
                  STATUT: {user.portfolioStatus}
               </Badge>
            </div>

            <div className="pt-6 border-t border-slate-50 space-y-4">
               <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-400 uppercase">Diplômes</span>
                  <span className="font-black text-slate-900">{user.attestations?.length || 0}</span>
               </div>
               <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-400 uppercase">Missions</span>
                  <span className="font-black text-slate-900">{user.portfolioMissions?.length || 0}</span>
               </div>
            </div>
         </Card>

         <div className="md:col-span-2 space-y-6">
            <h3 className="text-xl font-black text-slate-900 px-2 flex items-center gap-2">
               <ShieldCheck className="w-6 h-6 text-emerald-500" /> Évaluation des Missions
            </h3>
            
            {user.portfolioMissions?.map((um: any) => (
               <Card key={um.id} className="p-8 border-none shadow-premium bg-white rounded-[2rem] space-y-6">
                  <div className="flex items-start justify-between">
                     <div className="space-y-1">
                        <h4 className="font-black text-slate-800 tracking-tight">{um.mission.title}</h4>
                        <p className="text-xs text-slate-500 max-w-md">{um.mission.description}</p>
                     </div>
                     <Badge className={`${um.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'} border-none font-black text-[10px] uppercase tracking-widest`}>
                        {um.status}
                     </Badge>
                  </div>

                  {/* Proofs Section */}
                  <div className="space-y-4">
                     <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-400" /> Livrables & Preuves (Drive)
                     </h5>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {um.proofs && um.proofs.length > 0 ? (
                           um.proofs.map((proof: any) => (
                              <a 
                                 key={proof.id} 
                                 href={proof.url} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all group/proof"
                              >
                                 <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-indigo-600">
                                       <ExternalLink className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 truncate">{proof.label}</span>
                                 </div>
                                 <ArrowLeft className="w-4 h-4 text-slate-300 rotate-180 transition-transform group-hover/proof:translate-x-1" />
                              </a>
                           ))
                        ) : (
                           <div className="col-span-2 p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center">
                              <p className="text-xs font-medium text-slate-400 italic">
                                 {um.submissionProof || "Aucune preuve numérique déposée."}
                              </p>
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Action & Feedback Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
                     <div className="space-y-4">
                        <div className="space-y-1">
                           <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Feed-back Mentorat</p>
                           <Textarea 
                              placeholder="Partagez vos corrections pédagogiques ici..."
                              className="rounded-2xl border-slate-100 bg-slate-50/50 text-xs min-h-[120px] focus:bg-white transition-all"
                              value={comments[um.id] || um.adminComment || ""}
                              onChange={(e) => setComments({...comments, [um.id]: e.target.value})}
                           />
                        </div>
                        <div className="flex gap-2">
                           <Button 
                              size="sm" variant="outline" 
                              onClick={() => handleUpdateMission(um.id, "REJECTED")}
                              className="flex-1 rounded-xl h-11 border-rose-200 text-rose-600 font-bold hover:bg-rose-50"
                           >
                              Demander Correction
                           </Button>
                           <Button 
                              size="sm" 
                              onClick={() => handleUpdateMission(um.id, "COMPLETED")}
                              className={`flex-1 rounded-xl h-11 font-bold ${um.status === 'COMPLETED' ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white shadow-lg shadow-slate-200'}`}
                              disabled={um.status === 'COMPLETED'}
                           >
                              Valider l'Étape
                           </Button>
                        </div>
                     </div>

                     {/* Project Chat Integration */}
                     <div className="bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col h-[300px] overflow-hidden">
                        <div className="p-3 bg-white/50 border-b border-slate-100 flex items-center justify-between">
                           <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Discussion Projet</span>
                           <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[9px] font-bold text-slate-500">En direct</span>
                           </div>
                        </div>
                        <div className="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-hide">
                            <ProjectChat missionId={um.id} studentId={user.id} />
                        </div>
                     </div>
                  </div>
               </Card>
            ))}
         </div>
      </div>
    </div>
  );
}
