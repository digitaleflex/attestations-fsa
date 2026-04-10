"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  Loader2, 
  Target, 
  BookOpen, 
  Layers,
  ArrowUpDown,
  Users,
  Clock,
  Trophy,
  History,
  FileText
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminMissionsPage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    type: "EXERCISE",
    guideMarkdown: "",
    requiredExamId: "none",
    minScoreRequired: "13",
    order: "0", 
    formationId: "all", 
    dueDate: "" 
  });

  const { data: missions, isLoading } = useQuery({
    queryKey: ["admin-missions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/portfolio/missions");
      return res.json();
    }
  });

  const { data: formations } = useQuery({
    queryKey: ["admin-formations"],
    queryFn: async () => {
      const res = await fetch("/api/formations");
      return res.json();
    }
  });

  const { data: exams } = useQuery({
    queryKey: ["admin-exams-list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/exams/list");
      return res.json();
    }
  });

  const missionMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = editingId ? "PATCH" : "POST";
      const body = editingId ? { ...data, id: editingId } : data;
      const res = await fetch("/api/admin/portfolio/missions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body === "all" ? { ...body, formationId: null } : body),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
      resetForm();
      toast.success("Mission enregistrée !");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/admin/portfolio/missions?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
      toast.success("Mission supprimée !");
    }
  });

  const resetForm = () => {
    setForm({ 
      title: "", 
      description: "", 
      type: "EXERCISE",
      guideMarkdown: "",
      requiredExamId: "none",
      minScoreRequired: "13",
      order: "0", 
      formationId: "all", 
      dueDate: "" 
    });
    setEditingId(null);
    setIsEditing(false);
  };

  const startEdit = (mission: any) => {
    setForm({
      title: mission.title,
      description: mission.description,
      type: mission.type || "EXERCISE",
      guideMarkdown: mission.guideMarkdown || "",
      requiredExamId: mission.requiredExamId || "none",
      minScoreRequired: (mission.minScoreRequired || 13).toString(),
      order: mission.order.toString(),
      formationId: mission.formationId || "all",
      dueDate: mission.dueDate ? new Date(mission.dueDate).toISOString().split('T')[0] : ""
    });
    setEditingId(mission.id);
    setIsEditing(true);
  };

  if (isLoading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
       <div className="flex items-center justify-between">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestion des Missions</h1>
             <p className="text-slate-500 text-sm">Créez et organisez les défis pour les portfolios des candidats.</p>
          </div>
          <Button onClick={() => setIsEditing(true)} className="bg-slate-900 hover:bg-black rounded-2xl h-12 px-6 shadow-xl gap-2 font-bold">
             <Plus className="w-5 h-5" /> Nouvelle Mission
          </Button>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulaire de création / édition */}
          <div className="lg:col-span-1 space-y-4">
             {isEditing ? (
                <Card className="p-6 border-none shadow-2xl bg-white sticky top-24 animate-in slide-in-from-left-4 duration-500">
                   <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                      <Target className="w-5 h-5 text-indigo-600" /> {editingId ? "Modifier la mission" : "Créer une mission"}
                   </h2>
                   <div className="space-y-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Titre de la mission</label>
                         <Input 
                            value={form.title} 
                            onChange={(e) => setForm({...form, title: e.target.value})} 
                            placeholder="Ex: Maîtrise des circuits d'eau" 
                            className="rounded-xl border-slate-200 h-11"
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Description détaillée</label>
                         <Textarea 
                            value={form.description} 
                            onChange={(e) => setForm({...form, description: e.target.value})} 
                            placeholder="Décrivez les objectifs et les preuves attendues..." 
                            className="rounded-xl border-slate-200 min-h-[120px]"
                         />
                      </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Type de mission</label>
                             <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                                <SelectTrigger className="rounded-xl border-slate-200 h-11">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="EXERCISE">Exercice Classique</SelectItem>
                                   <SelectItem value="PROJECT">Projet Pratique</SelectItem>
                                   <SelectItem value="FIELD_SUPPORT">Accompagnement Terrain</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Ordre d'affichage</label>
                             <Input 
                                type="number"
                                value={form.order} 
                                onChange={(e) => setForm({...form, order: e.target.value})} 
                                className="rounded-xl border-slate-200 h-11"
                             />
                          </div>
                       </div>

                       {form.type === "PROJECT" && (
                          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-4 animate-in zoom-in-95 duration-300">
                             <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-tight">
                                <Trophy className="w-4 h-4" /> Configuration du Projet
                             </div>
                             <div className="space-y-1">
                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Examen prérequis</label>
                                <Select value={form.requiredExamId} onValueChange={(v) => setForm({...form, requiredExamId: v})}>
                                   <SelectTrigger className="rounded-xl border-none h-11 bg-white shadow-sm">
                                      <SelectValue placeholder="Aucun examen requis" />
                                   </SelectTrigger>
                                   <SelectContent>
                                      <SelectItem value="none">Aucun examen requis</SelectItem>
                                      {exams?.map((e: any) => (
                                         <SelectItem key={e.id} value={e.id}>{e.title} ({e.formation?.name})</SelectItem>
                                      ))}
                                   </SelectContent>
                                </Select>
                             </div>
                             <div className="space-y-1">
                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Note minimale (sur 20)</label>
                                <Input 
                                   type="number"
                                   step="0.5"
                                   value={form.minScoreRequired} 
                                   onChange={(e) => setForm({...form, minScoreRequired: e.target.value})} 
                                   className="rounded-xl border-none h-11 bg-white shadow-sm"
                                />
                             </div>
                          </div>
                       )}

                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                             {form.type === "PROJECT" ? "Guide de mise en œuvre (Markdown)" : "Instructions complémentaires"}
                          </label>
                          <Textarea 
                             value={form.guideMarkdown} 
                             onChange={(e) => setForm({...form, guideMarkdown: e.target.value})} 
                             placeholder={form.type === "PROJECT" ? "# Étapes du projet\n1. Prérequis...\n2. Ressources..." : "Optionnel : Détails supplémentaires..."} 
                             className="rounded-xl border-slate-200 min-h-[150px] font-mono text-xs"
                          />
                       </div>

                       <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Date d'échéance (Optionnelle)</label>
                         <Input 
                            type="date"
                            value={form.dueDate} 
                            onChange={(e) => setForm({...form, dueDate: e.target.value})} 
                            className="rounded-xl border-slate-200 h-11"
                         />
                      </div>
                      <div className="flex gap-2 pt-4">
                         <Button onClick={() => missionMutation.mutate(form)} disabled={missionMutation.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-11 rounded-xl font-bold shadow-lg shadow-indigo-100">
                            Enregistrer
                         </Button>
                         <Button variant="ghost" onClick={resetForm} className="rounded-xl h-11 text-slate-500">Annuler</Button>
                      </div>
                   </div>
                </Card>
             ) : (
                <div className="h-64 rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center p-8 opacity-50">
                   <Target className="w-10 h-10 text-slate-200 mb-4" />
                   <p className="text-xs font-bold text-slate-400">Cliquez sur une mission pour la modifier ou créez-en une nouvelle.</p>
                </div>
             )}
          </div>

          {/* Liste des Missions */}
          <div className="lg:col-span-2 space-y-4">
             {missions?.map((m: any) => (
                <Card key={m.id} className="p-6 border-none shadow-premium bg-white group hover:shadow-xl transition-all relative overflow-hidden">
                   <div className="flex items-center gap-6">
                       <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          {m.type === "PROJECT" ? <Trophy className="w-6 h-6" /> : m.type === "FIELD_SUPPORT" ? <Users className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                       </div>
                      <div className="flex-1">
                          <div className="flex items-center gap-2">
                             <h3 className="font-bold text-slate-800">{m.title}</h3>
                             <Badge variant="outline" className={`border-none px-2 py-0 text-[8px] uppercase ${
                               m.type === 'PROJECT' ? 'bg-amber-50 text-amber-700' : 
                               m.type === 'FIELD_SUPPORT' ? 'bg-emerald-50 text-emerald-700' : 
                               'bg-slate-50 text-slate-600'
                             }`}>
                               {m.type === 'PROJECT' ? 'Projet' : m.type === 'FIELD_SUPPORT' ? 'Accompagnement' : 'Exercice'}
                             </Badge>
                             {m.formation?.name && <Badge className="bg-indigo-50 text-indigo-700 border-none px-2 py-0 text-[8px] uppercase">{m.formation.name}</Badge>}
                          </div>
                         <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.description}</p>
                         <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-full">
                               <Users className="w-3 h-3" /> {m._count?.userMissions || 0} COMPLÉTIONS
                            </div>
                            {m.dueDate && (
                               <div className="flex items-center gap-1 text-[10px] font-black text-rose-600 uppercase bg-rose-50 px-2 py-0.5 rounded-full">
                                  <Clock className="w-3 h-3" /> ÉCHÉANCE : {new Date(m.dueDate).toLocaleDateString()}
                               </div>
                            )}
                         </div>
                      </div>
                      <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" onClick={() => startEdit(m)} className="rounded-full hover:bg-emerald-50 hover:text-emerald-600">
                            <Edit3 className="w-4 h-4" />
                         </Button>
                         <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)} className="rounded-full hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                   </div>
                </Card>
             ))}
          </div>
       </div>
    </div>
  );
}
