"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  ClipboardCheck,
  Calendar,
  Clock,
  MoreVertical,
  CheckCircle2,
  Users,
  Search,
  LayoutGrid,
  List,
  History as HistoryIcon,
  TrendingUp,
  FileText,
  ChevronRight,
  LucideIcon
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Exam = {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
  scheduledAt: string | null;
  totalPoints: number;
  createdAt: string;
  session: string | null;
  _count: {
    submissions: number;
  };
};

export default function ExamsContent() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const res = await fetch("/api/exams");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setExams(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/exams/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      setExams((prev) => prev.filter((e) => e.id !== deleteId));
      toast.success("Examen supprimé !");
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Erreur inconnue");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const statusConfig: Record<Exam['status'], { label: string; color: string; icon: LucideIcon; dot: string }> = {
    DRAFT: { label: "Brouillon", color: "text-slate-500 bg-slate-50 border-slate-100", icon: Edit, dot: "bg-slate-300" },
    PUBLISHED: { label: "En ligne", color: "text-emerald-700 bg-emerald-50 border-emerald-100", icon: CheckCircle2, dot: "bg-emerald-500" },
    SCHEDULED: { label: "Programmé", color: "text-blue-700 bg-blue-50 border-blue-100", icon: Calendar, dot: "bg-blue-500" },
    ARCHIVED: { label: "Archivé", color: "text-amber-700 bg-amber-50 border-amber-100", icon: HistoryIcon, dot: "bg-amber-500" },
  };

  const filteredExams = exams.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-screen bg-slate-50/50">
        <Loader2 className="animate-spin w-10 h-10 text-blue-500 mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Chargement des examens...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 min-h-screen bg-slate-50/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutGrid className="w-10 h-10 text-blue-600" />
            Gestion des Examens
          </h1>
          <p className="text-slate-500 font-medium mt-1">Créez, planifiez et suivez les épreuves académiques</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une épreuve..."
                className="pl-10 w-full md:w-80 bg-white border-slate-200 focus:ring-blue-500 transition-all rounded-xl"
            />
          </div>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <Button
                variant={view === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('grid')}
                className={`rounded-lg h-9 px-3 ${view === 'grid' ? 'bg-blue-600 shadow-blue-100' : 'text-slate-400'}`}
            >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Grille
            </Button>
            <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
                className={`rounded-lg h-9 px-3 ${view === 'list' ? 'bg-blue-600 shadow-blue-100' : 'text-slate-400'}`}
            >
                <List className="w-4 h-4 mr-2" />
                Liste
            </Button>
          </div>

          <Link href="/admin/exams/new">
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 rounded-xl shadow-lg shadow-blue-100">
                <Plus className="w-5 h-5" />
                Nouvel Examen
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-slate-200">
          <Loader2 className="animate-spin w-10 h-10 text-blue-500 mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Synchronisation des épreuves...</p>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-800 font-black text-lg">{search ? "Aucun résultat trouvé" : "Aucun examen disponible"}</p>
          <p className="text-slate-400 text-sm mt-1">Commencez par créer votre première épreuve d&apos;évaluation.</p>
        </div>
      ) : (
        view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredExams.map((exam) => {
            const config = statusConfig[exam.status as keyof typeof statusConfig];
            const StatusIcon = config.icon;

            return (
              <Card key={exam.id} className="group relative bg-white border border-slate-100 hover:border-blue-200 rounded-[28px] overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-blue-100 hover:-translate-y-1">
                {/* Header Decoration */}
                <div className={`h-1.5 w-full ${config.dot === 'bg-emerald-500' ? 'bg-emerald-500' : config.dot === 'bg-blue-500' ? 'bg-blue-500' : 'bg-slate-300'}`} />

                <div className="p-8 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-6">
                        <div className={`p-4 rounded-2xl ${config.color} border shadow-sm`}>
                            <StatusIcon className="w-6 h-6" />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-full hover:bg-slate-50 drop-shadow-sm">
                                <MoreVertical className="w-5 h-5 text-slate-400" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl bg-white border-slate-100 shadow-2xl">
                                <DropdownMenuItem asChild className="rounded-xl focus:bg-slate-50 transition-colors">
                                    <Link href={`/admin/exams/${exam.id}/edit`} className="flex items-center gap-3 font-bold text-slate-700 py-2.5">
                                        <Edit className="w-4 h-4 text-slate-400" />
                                        Éditer l&apos;organisation
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="rounded-xl focus:bg-slate-50 transition-colors">
                                    <Link href={`/admin/submissions?examId=${exam.id}`} className="flex items-center gap-3 font-bold text-slate-700 py-2.5">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                        Performance & Résultats
                                    </Link>
                                </DropdownMenuItem>
                                <div className="h-px bg-slate-100 my-2" />
                                <DropdownMenuItem
                                    onClick={() => setDeleteId(exam.id)}
                                    className="rounded-xl focus:bg-rose-50 text-rose-600 focus:text-rose-700 font-bold py-2.5 flex items-center gap-3"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Supprimer définitivement
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`h-2 w-2 rounded-full p-0 border-none ${config.dot} animate-pulse`} />
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">{config.label}</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors min-h-[3rem] line-clamp-2">
                            {exam.title}
                        </h3>
                        {exam.session && (
                          <div className="flex items-center gap-1 mt-1">
                             <Badge variant="outline" className="bg-slate-900 text-white border-none rounded-md px-2 py-0 text-[9px] font-black">{exam.session}</Badge>
                          </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8 pt-4 border-t border-slate-50">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Users className="w-3 h-3" />
                                Candidats
                            </p>
                            <p className="text-lg font-black text-slate-800">{exam._count.submissions}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <ClipboardCheck className="w-3 h-3" />
                                Score Max
                            </p>
                            <p className="text-lg font-black text-slate-800">{exam.totalPoints} <span className="text-xs text-slate-400 font-bold">pts</span></p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(exam.status === 'SCHEDULED' && exam.scheduledAt ? exam.scheduledAt : exam.createdAt).toLocaleDateString("fr-FR", { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                        </div>
                        <Link href={`/admin/exams/${exam.id}/edit`}>
                            <Button size="sm" variant="outline" className="rounded-xl font-bold bg-slate-50 border-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all px-4">
                                Gérer
                            </Button>
                        </Link>
                    </div>
                </div>
              </Card>
            );
          })}
        </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50/50 border-b border-slate-100">
                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Épreuve</th>
                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Statut</th>
                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Points</th>
                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {filteredExams.map((exam) => {
                   const config = statusConfig[exam.status as keyof typeof statusConfig];
                   return (
                     <tr key={exam.id} className="hover:bg-slate-50/30 transition-colors group">
                       <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.color} border shadow-sm`}>
                                <config.icon className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="font-black text-slate-900 leading-tight">{exam.title}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider italic flex items-center gap-1">
                                   <Users className="w-3 h-3" /> {exam._count.submissions} candidats inscrits {exam.session && `• SESSION ${exam.session}`}
                                </p>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-5">
                         <div className="flex items-center gap-2">
                           <div className={`h-2 w-2 rounded-full ${config.dot}`} />
                           <span className="text-xs font-bold text-slate-600">{config.label}</span>
                         </div>
                       </td>
                       <td className="px-8 py-5">
                         <span className="text-sm font-black text-slate-800">{exam.totalPoints} pts</span>
                       </td>
                       <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <Link href={`/admin/exams/${exam.id}/edit`}>
                                <Button size="sm" variant="ghost" className="rounded-lg h-9 w-9 p-0 hover:bg-white hover:shadow-sm">
                                   <Edit className="w-4 h-4 text-slate-400" />
                                </Button>
                             </Link>
                             <Button size="sm" variant="ghost" className="rounded-lg h-9 w-9 p-0 hover:bg-white hover:shadow-sm text-rose-500" onClick={() => setDeleteId(exam.id)}>
                                <Trash2 className="w-4 h-4" />
                             </Button>
                             <Link href={`/admin/exams/${exam.id}/edit`}>
                                <Button size="sm" variant="outline" className="rounded-xl h-9 px-4 font-bold bg-slate-50 hover:bg-blue-600 hover:text-white transition-all">
                                   Gérer <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                             </Link>
                          </div>
                       </td>
                     </tr>
                   )
                 })}
               </tbody>
             </table>
          </div>
        )
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl rounded-[32px] p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-black text-2xl">
              <Trash2 className="w-8 h-8" />
              Confirmation de Suppression
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-lg leading-relaxed mt-4">
              Voulez-vous vraiment supprimer cet examen ? Cette action entraînera la perte définitive de <span className="font-bold text-slate-900 underline decoration-rose-200">toutes les questions</span> et données associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel
              disabled={isDeleting}
              className="rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold px-8 h-12"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-8 h-12 shadow-lg shadow-rose-200 transition-all hover:scale-105"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                "Confirmer la Suppression"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
