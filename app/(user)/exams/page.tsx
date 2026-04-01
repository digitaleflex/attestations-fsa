"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, CheckCircle, Play, BarChart3, Filter, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function UserExamsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["user-exams"],
    queryFn: async () => {
      const res = await fetch("/api/user/exams");
      if (!res.ok) {
        if (res.status === 401) router.push("/admin/login");
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const filteredExams = data?.exams?.filter((exam: any) => {
    if (statusFilter === "all") return true;
    return exam.status === statusFilter.toUpperCase();
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-700 border-blue-200";
      case "AVAILABLE": return "bg-slate-100 text-slate-700 border-slate-200";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "COMPLETED": return "Terminé";
      case "IN_PROGRESS": return "En cours";
      case "AVAILABLE": return "Disponible";
      default: return status;
    }
  };

  const getActionLabel = (status: string) => {
    switch (status) {
      case "COMPLETED": return "Voir résultats";
      case "IN_PROGRESS": return "Reprendre";
      case "AVAILABLE": return "Commencer";
      default: return "Voir";
    }
  };

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
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Centre d'Examens</h1>
              <p className="text-xs text-slate-500">Passez vos examens en ligne</p>
            </div>
          </div>
          <Link href="/user/dashboard">
            <Button variant="outline" size="sm">← Retour</Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 bg-white shadow-sm">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-bold text-slate-800">{data?.stats?.total || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-slate-500">
            <p className="text-sm text-slate-500">Disponibles</p>
            <p className="text-2xl font-bold text-slate-600">{data?.stats?.available || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
            <p className="text-sm text-slate-500">En cours</p>
            <p className="text-2xl font-bold text-blue-600">{data?.stats?.inProgress || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-sm text-slate-500">Terminés</p>
            <p className="text-2xl font-bold text-emerald-600">{data?.stats?.completed || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-purple-500">
            <p className="text-sm text-slate-500">Réussis</p>
            <p className="text-2xl font-bold text-purple-600">{data?.stats?.passed || 0}</p>
          </Card>
        </div>

        {/* Filter */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Filtrer par statut</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-10">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="AVAILABLE">Disponibles</SelectItem>
                <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                <SelectItem value="COMPLETED">Terminés</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {statusFilter !== "all" && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="gap-2 text-xs"
              >
                <X className="w-3 h-3" />
                Réinitialiser
              </Button>
            </div>
          )}
        </Card>

        {/* List */}
        {!filteredExams || filteredExams.length === 0 ? (
          <Card className="p-12 bg-white shadow-sm">
            <div className="text-center">
              <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-600">Aucun examen trouvé</p>
              <p className="text-sm text-slate-500 mt-1">
                {statusFilter !== "all" ? "Essayez de modifier vos filtres" : "Les examens disponibles apparaîtront ici"}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredExams.map((exam: any) => (
              <Card key={exam.id} className="p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">{exam.examName}</h3>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                          {exam.examDescription || "Aucune description"}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusBadgeColor(exam.status)}>
                      {getStatusLabel(exam.status)}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{exam.duration || "Illimité"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      <span>{exam.questionCount || 0} questions</span>
                    </div>
                  </div>

                  {/* Score if completed */}
                  {exam.status === "COMPLETED" && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                          <span className="text-sm font-medium text-slate-700">Score obtenu</span>
                        </div>
                        <span className={`text-2xl font-bold ${exam.score >= 70 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {exam.score}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t">
                    <Link href={`/user/exams/${exam.id}`} className="flex-1">
                      <Button className="w-full gap-2" variant={exam.status === "AVAILABLE" ? "default" : "outline"}>
                        {exam.status === "AVAILABLE" ? (
                          <>
                            <Play className="w-4 h-4" />
                            Commencer
                          </>
                        ) : exam.status === "IN_PROGRESS" ? (
                          <>
                            <Play className="w-4 h-4" />
                            Reprendre
                          </>
                        ) : (
                          <>
                            <BarChart3 className="w-4 h-4" />
                            Résultats
                          </>
                        )}
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
