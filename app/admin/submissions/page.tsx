"use client";

import { useState, Suspense, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ClipboardCheck, 
  Search, 
  Filter, 
  X, 
  Eye, 
  Clock, 
  CheckCircle, 
  Download, 
  RefreshCcw,
  LucideIcon,
  BookOpen,
  Trophy,
  AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function SubmissionsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [examFilter, setExamFilter] = useState(searchParams?.get("examId") || "all");

  useEffect(() => {
    const eid = searchParams?.get("examId");
    if (eid) setExamFilter(eid);
  }, [searchParams]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/submissions");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const filteredSubmissions = data?.submissions?.filter((sub: any) => {
    const matchSearch = (sub.candidate?.name?.toLowerCase().includes(search.toLowerCase()) ||
                        sub.candidate?.email?.toLowerCase().includes(search.toLowerCase()) ||
                        sub.exam?.name?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || sub.status === statusFilter;
    const matchType = typeFilter === "all" || sub.exam?.type === typeFilter || sub.type === typeFilter;
    const matchExam = examFilter === "all" || sub.examId === examFilter;
    return matchSearch && matchStatus && matchType && matchExam;
  }) || [];

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "GRADED":
      case "COMPLETED": return "bg-emerald-100 text-emerald-700 shadow-md shadow-emerald-100/50";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-700 shadow-md shadow-blue-100/50";
      case "PENDING_REVIEW": return "bg-amber-100 text-amber-700 shadow-md shadow-amber-100/50 animate-pulse";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "GRADED":
      case "COMPLETED": return "Corrigé";
      case "IN_PROGRESS": return "En cours";
      case "PENDING_REVIEW": return "À corriger";
      default: return status;
    }
  };

  const exportToCSV = () => {
    if (filteredSubmissions.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const headers = ["Candidat", "Email", "Examen", "Type", "Status", "Score Examen", "Note Stage", "Note Globale", "Date"];
    const csvContent = filteredSubmissions.map((sub: any) => [
      sub.candidate?.name || "N/A",
      sub.candidate?.email || "N/A",
      sub.exam?.name || "N/A",
      sub.exam?.type || "N/A",
      sub.status,
      sub.score !== null ? `${sub.score}%` : "Non noté",
      sub.internshipScore !== null ? `${sub.internshipScore}%` : "N/A",
      sub.finalScore !== null ? `${sub.finalScore}%` : "N/A",
      sub.startedAt ? new Date(sub.startedAt).toLocaleDateString("fr-FR") : "N/A"
    ].join(",")).join("\n");

    const blob = new Blob([[headers.join(","), csvContent].join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resultats_fsa_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Exportation terminée");
  };

  const uniqueExams = Array.from(new Map(data?.submissions?.map((s: any) => [s.examId, s.exam])).values());

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-10 h-10 animate-spin text-primary opacity-20" />
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Récupération des soumissions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 animate-in fade-in duration-500">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
               <div className="flex items-center gap-2 text-indigo-600 mb-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest">Espace Pédagogique</span>
               </div>
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestion des Copies</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Button 
                onClick={exportToCSV}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold h-11 px-6 shadow-xl shadow-slate-200 gap-2"
             >
                <Download className="w-4 h-4" /> Exporter CSV
             </Button>
             <Button 
                variant="outline" 
                onClick={() => refetch()}
                className="h-11 w-11 rounded-xl bg-white border-slate-200"
             >
                <RefreshCcw className="w-4 h-4 text-slate-500" />
             </Button>
             <Link href="/admin/dashboard">
                <Button variant="ghost" className="rounded-xl h-11 font-bold">Quitter</Button>
             </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatsCard 
              title="À Corriger" 
              value={data?.stats?.pendingReview || 0} 
              icon={AlertCircle}
              color="amber"
              description="Nécessite une action admin"
            />
            <StatsCard 
              title="Corrigés" 
              value={data?.stats?.completed || 0} 
              icon={CheckCircle}
              color="emerald"
              description="Notation terminée"
            />
            <StatsCard 
              title="En Cours" 
              value={data?.stats?.inProgress || 0} 
              icon={Clock}
              color="blue"
              description="Sessions actives"
            />
            <StatsCard 
              title="Taux Réussite" 
              value={`${Math.round(((data?.stats?.passed || 0) / (data?.stats?.completed || 1)) * 100)}%`} 
              icon={Trophy}
              color="indigo"
              description="Ratio d'admis"
            />
        </div>

        {/* Dedicated Space Tabs */}
        <div className="flex flex-col gap-4">
          <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full">
            <TabsList className="bg-slate-50 p-1.5 h-14 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto">
              <TabsTrigger value="all" className="px-10 h-full font-black text-xs uppercase tracking-widest rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg">
                Toutes les copies
              </TabsTrigger>
              <TabsTrigger value="OFFICIAL" className="px-10 h-full font-black text-xs uppercase tracking-widest rounded-xl data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-lg">
                Session Officielle
              </TabsTrigger>
              <TabsTrigger value="MOCK" className="px-10 h-full font-black text-xs uppercase tracking-widest rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-lg">
                Examens Blancs
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Filters Card */}
        <Card className="p-6 border-none shadow-2xl shadow-slate-200/50 rounded-3xl bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 opacity-20" />
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-black uppercase tracking-widest text-slate-800">Filtres de recherche</span>
                </div>
                { (search || statusFilter !== "all" || examFilter !== "all" || typeFilter !== "all") && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setSearch(""); setStatusFilter("all"); setExamFilter("all"); setTypeFilter("all"); }}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg gap-2"
                    >
                        <X className="w-3 h-3" /> Réinitialiser
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 font-bold" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Chercher par nom, email ou examen..."
                    className="pl-12 h-14 bg-slate-50/50 border-none rounded-2xl focus:ring-slate-200 font-bold placeholder:text-slate-400 placeholder:font-medium"
                />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-14 bg-slate-50/50 border-none rounded-2xl font-bold px-6">
                    <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 shadow-2xl p-2 font-bold">
                    <SelectItem value="all" className="rounded-xl">Tous les Statuts</SelectItem>
                    <SelectItem value="PENDING_REVIEW" className="rounded-xl">À corriger</SelectItem>
                    <SelectItem value="IN_PROGRESS" className="rounded-xl">En cours</SelectItem>
                    <SelectItem value="GRADED" className="rounded-xl">Corrigé</SelectItem>
                </SelectContent>
                </Select>
                <Select value={examFilter} onValueChange={setExamFilter}>
                <SelectTrigger className="h-14 bg-slate-50/50 border-none rounded-2xl font-bold px-6">
                    <SelectValue placeholder="Examen" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 shadow-2xl p-2 font-bold max-h-[300px]">
                    <SelectItem value="all" className="rounded-xl">Tous les Examens</SelectItem>
                    {uniqueExams.map((exam: any) => (
                    <SelectItem key={exam.id} value={exam.id} className="rounded-xl">{exam.name}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
          </div>
        </Card>

        {/* Submissions Grid */}
        {!filteredSubmissions || filteredSubmissions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSubmissions.map((sub: any) => (
              <Card key={sub.id} className="group p-6 border-none shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-500 rounded-3xl bg-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full transition-all group-hover:w-4 bg-slate-50 group-hover:bg-indigo-500" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:scale-95 transition-transform group-hover:bg-white group-hover:shadow-md">
                        <UserIcon className="w-7 h-7 text-slate-300 group-hover:text-indigo-500" name={sub.candidate?.name} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-black text-slate-900 tracking-tight text-lg group-hover:text-indigo-600 transition-colors uppercase">
                            {sub.candidate?.name || "Candidat Anonyme"}
                        </h3>
                        <Badge className={cn("font-black text-[10px] uppercase px-3 py-1 border-none tracking-widest", getStatusBadgeStyle(sub.status))}>
                          {getStatusLabel(sub.status)}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-300" />
                        {sub.exam?.name}
                      </p>
                      <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg">
                          <Clock className="w-3 h-3" />
                          {sub.startedAt ? new Date(sub.startedAt).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short' }) : "-"}
                        </span>
                        <Badge variant="outline" className={cn(
                            "border-none px-2.5 py-1 rounded-lg text-slate-400 bg-slate-50 font-black",
                            (sub.exam?.type === 'MOCK' || sub.type === 'MOCK') && "bg-indigo-50 text-indigo-500"
                        )}>
                          {sub.exam?.type === 'MOCK' || sub.type === 'MOCK' ? "EXAM BLANC" : "OFFICIEL"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-4">
                    {sub.status === "GRADED" || sub.status === "COMPLETED" ? (
                       <div className="flex flex-col gap-2">
                          <div className="text-center bg-emerald-50 p-2 rounded-xl border border-emerald-100 shadow-inner group-hover:bg-emerald-500 transition-colors w-24">
                              <p className="text-[8px] font-black uppercase text-emerald-600 group-hover:text-white transition-colors">Examen</p>
                              <p className="text-sm font-black text-emerald-700 group-hover:text-white transition-colors">{sub.score}%</p>
                          </div>
                          <div className="text-center bg-blue-50 p-2 rounded-xl border border-blue-100 shadow-inner group-hover:bg-blue-600 transition-colors w-24">
                              <p className="text-[8px] font-black uppercase text-blue-600 group-hover:text-white transition-colors">Stage</p>
                              <p className="text-sm font-black text-blue-700 group-hover:text-white transition-colors">{sub.internshipScore}%</p>
                          </div>
                          <div className="text-center bg-indigo-600 p-2 rounded-xl border border-indigo-700 shadow-lg w-24">
                              <p className="text-[8px] font-black uppercase text-indigo-100">Global</p>
                              <p className="text-base font-black text-white">{Math.round(sub.finalScore)}%</p>
                          </div>
                       </div>
                    ) : (
                        <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center group-hover:border-indigo-200 transition-colors">
                            <span className="text-[10px] font-black text-slate-300">N/A</span>
                        </div>
                    )}
                    <Link href={`/admin/submissions/${sub.id}`}>
                      <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-slate-900 hover:text-white group-hover:shadow-lg transition-all">
                        <Eye className="w-5 h-5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function UserIcon({ name, className }: { name?: string, className?: string }) {
    return (
        <span className={className}>
            {name ? name.charAt(0).toUpperCase() : "?"}
        </span>
    )
}

function StatsCard({ title, value, icon: Icon, color, description }: any) {
    const colors: any = {
      amber: "bg-amber-50 text-amber-600 shadow-amber-100/50",
      emerald: "bg-emerald-50 text-emerald-600 shadow-emerald-100/50",
      blue: "bg-blue-50 text-blue-600 shadow-blue-100/50",
      indigo: "bg-indigo-50 text-indigo-600 shadow-indigo-100/50"
    };
  
    return (
      <Card className="p-6 border-none shadow-xl shadow-slate-200/50 bg-white relative overflow-hidden group hover:-translate-y-1 transition-all duration-500">
        <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full bg-slate-50 opacity-20 group-hover:scale-110 transition-transform" />
        <div className="flex items-start gap-4 mb-4 relative z-10">
           <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-6", colors[color])}>
             <Icon className="w-7 h-7" />
           </div>
           <div className="flex-1">
              <p className="text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">{title}</p>
           </div>
        </div>
        <div className="flex items-center gap-2 pt-4 border-t border-slate-50 relative z-10">
           <Badge variant="outline" className="bg-slate-50 text-slate-400 border-none text-[9px] font-black uppercase tracking-widest">Update Live</Badge>
           <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest opacity-60">{description}</span>
        </div>
      </Card>
    );
}

function EmptyState() {
    return (
        <Card className="p-20 border-none shadow-2xl shadow-slate-200/50 rounded-[40px] bg-white overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-50/20 via-transparent to-transparent opacity-50" />
            <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-3xl bg-slate-50 flex items-center justify-center mb-8 shadow-inner group transition-all">
                    <ClipboardCheck className="w-12 h-12 text-slate-200 group-hover:text-indigo-500 transition-colors" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Aucune soumission trouvée</h3>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest max-w-[300px]">
                    Essayez de modifier vos filtres pour voir les autres copies des candidats.
                </p>
                <div className="mt-8 flex gap-3">
                    <Button variant="outline" className="rounded-xl h-12 px-6 font-bold shadow-sm" onClick={() => window.location.reload()}>
                        Dernière actualisation : {new Date().toLocaleTimeString()}
                    </Button>
                </div>
            </div>
        </Card>
    )
}

export default function AdminSubmissionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Initialisation du laboratoire...</div>}>
      <SubmissionsList />
    </Suspense>
  );
}

