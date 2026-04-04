"use client";

import { useState, Suspense, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ClipboardCheck, Search, Filter, X, Eye, Clock, CheckCircle } from "lucide-react";
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

function SubmissionsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [examFilter, setExamFilter] = useState(searchParams?.get("examId") || "all");

  useEffect(() => {
    const eid = searchParams?.get("examId");
    if (eid) setExamFilter(eid);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/submissions");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const filteredSubmissions = data?.submissions?.filter((sub: any) => {
    const matchSearch = sub.candidate?.name?.toLowerCase().includes(search.toLowerCase()) ||
      sub.exam?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || sub.status === statusFilter;
    const matchExam = examFilter === "all" || sub.examId === examFilter;
    return matchSearch && matchStatus && matchExam;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-700 border-blue-200";
      case "PENDING_REVIEW": return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "COMPLETED": return "Corrigé";
      case "IN_PROGRESS": return "En cours";
      case "PENDING_REVIEW": return "À corriger";
      default: return status;
    }
  };

  const uniqueExams = Array.from(new Map(data?.submissions?.map((s: any) => [s.examId, s.exam])).values());

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Corrections d'Examens</h1>
              <p className="text-xs text-slate-500">Gérez les soumissions des candidats</p>
            </div>
          </div>
          <Link href="/admin/dashboard">
            <Button variant="outline" size="sm">← Retour</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 bg-white shadow-sm">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-bold text-slate-800">{data?.stats?.total || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-amber-500">
            <p className="text-sm text-slate-500">À corriger</p>
            <p className="text-2xl font-bold text-amber-600">{data?.stats?.pendingReview || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
            <p className="text-sm text-slate-500">En cours</p>
            <p className="text-2xl font-bold text-blue-600">{data?.stats?.inProgress || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-sm text-slate-500">Corrigés</p>
            <p className="text-2xl font-bold text-emerald-600">{data?.stats?.completed || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-purple-500">
            <p className="text-sm text-slate-500">Réussis</p>
            <p className="text-2xl font-bold text-purple-600">{data?.stats?.passed || 0}</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Filtres</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par candidat ou examen..."
                className="pl-10 h-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="PENDING_REVIEW">À corriger</SelectItem>
                <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                <SelectItem value="COMPLETED">Corrigé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={examFilter} onValueChange={setExamFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Examen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {uniqueExams.map((exam: any) => (
                  <SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(search || statusFilter !== "all" || examFilter !== "all") && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setExamFilter("all");
                }}
                className="gap-2 text-xs"
              >
                <X className="w-3 h-3" />
                Réinitialiser
              </Button>
              <Badge variant="secondary">{filteredSubmissions?.length || 0} résultat(s)</Badge>
            </div>
          )}
        </Card>

        {/* List */}
        {!filteredSubmissions || filteredSubmissions.length === 0 ? (
          <Card className="p-12 bg-white shadow-sm">
            <div className="text-center">
              <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-600">Aucune soumission trouvée</p>
              <p className="text-sm text-slate-500 mt-1">
                Essayez de modifier vos filtres
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredSubmissions.map((sub: any) => (
              <Card key={sub.id} className="p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <ClipboardCheck className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-800">{sub.candidate?.name || "Candidat"}</h3>
                        <Badge className={getStatusBadgeColor(sub.status)}>
                          {getStatusLabel(sub.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-1">
                        {sub.exam?.name}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {sub.startedAt ? new Date(sub.startedAt).toLocaleDateString("fr-FR") : "-"}
                        </span>
                        {sub.status === "COMPLETED" && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Score: {sub.score}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/admin/submissions/${sub.id}`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Eye className="w-4 h-4" />
                        Corriger
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

export default function AdminSubmissionsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SubmissionsList />
    </Suspense>
  );
}
