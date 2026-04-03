"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, CheckCircle, Play, BarChart3, Filter, X, ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SkeletonCard, SkeletonStats } from "@/components/SkeletonLoader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function UserExamsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
      <div className="space-y-8">
        <SkeletonStats />
        <Card className="p-4 bg-white animate-pulse h-16" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
                    <Link href={exam.status === "COMPLETED" ? `/results/${exam.submissionId}` : `/exams/${exam.id}`} className="flex-1">
                      <Button 
                        className="w-full gap-2 group transition-all" 
                        variant={exam.status === "AVAILABLE" ? "default" : "outline"}
                        onMouseEnter={() => {
                          if (exam.status !== "COMPLETED") {
                            queryClient.prefetchQuery({
                              queryKey: ["exam", exam.id],
                              queryFn: async () => {
                                const res = await fetch(`/api/exams/${exam.id}`);
                                return res.json();
                              },
                              staleTime: 5 * 60 * 1000,
                            });
                          } else if (exam.submissionId) {
                            queryClient.prefetchQuery({
                              queryKey: ["user-result", exam.submissionId],
                              queryFn: async () => {
                                const res = await fetch(`/api/user/results/${exam.submissionId}`);
                                return res.json();
                              },
                              staleTime: 5 * 60 * 1000,
                            });
                          }
                        }}
                      >
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
                            Voir mes notes
                          </>
                        )}
                        <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
