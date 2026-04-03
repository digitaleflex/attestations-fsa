"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, BarChart3, ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SkeletonCard, SkeletonStats } from "@/components/SkeletonLoader";
import { apiFetch } from "@/lib/api-client";

export default function UserResultsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user-results"],
    queryFn: () => apiFetch("/api/user/results"),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <SkeletonStats />
        <Card className="p-4 bg-white animate-pulse h-16" />
        <div className="grid grid-cols-1 gap-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-white shadow-sm">
          <p className="text-sm text-slate-500">Total examens</p>
          <p className="text-2xl font-bold text-slate-800">{data?.stats?.totalExams || 0}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-sm text-slate-500">Réussis</p>
          <p className="text-2xl font-bold text-emerald-600">{data?.stats?.passedExams || 0}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-rose-500">
          <p className="text-sm text-slate-500">Échoués</p>
          <p className="text-2xl font-bold text-rose-600">{data?.stats?.failedExams || 0}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
          <p className="text-sm text-slate-500">Score moyen</p>
          <p className="text-2xl font-bold text-blue-600">{data?.stats?.averageScore || 0}%</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-purple-500">
          <p className="text-sm text-slate-500">Meilleur score</p>
          <p className="text-2xl font-bold text-purple-600">{data?.stats?.bestScore || 0}%</p>
        </Card>
      </div>

      {!data?.results || data.results.length === 0 ? (
        <Card className="p-12 bg-white shadow-sm">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-600">Aucun résultat</p>
            <p className="text-sm text-slate-500 mt-1">
              Passez des examens pour voir vos résultats ici
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {data.results.map((result: any) => (
            <Card key={result.id} className="p-6 bg-white shadow-sm">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${result.passed ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                      {result.passed ? (
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <XCircle className="w-6 h-6 text-rose-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{result.examName}</h3>
                      <p className="text-sm text-slate-500">
                        {result.completedAt ? new Date(result.completedAt).toLocaleDateString("fr-FR") : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${result.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {result.scorePercent}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {result.totalScore}/{result.maxScore} points
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">Aperçu rapide</p>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400">Partie 1 (QCM)</p>
                        <p className="text-sm font-bold text-slate-700">{result.scorePart1}/{result.maxPart1 || 20}</p>
                      </div>
                      <div className="border-l border-slate-100 pl-4">
                        <p className="text-[10px] text-slate-400">Partie 2 & 3</p>
                        <p className="text-sm font-bold text-slate-700">{(result.scorePart2 || 0) + (result.scorePart3 || 0)}/{(result.maxPart2 || 40) + (result.maxPart3 || 40)}</p>
                      </div>
                    </div>
                  </div>
                  <Link href={`/results/${result.id}`}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onMouseEnter={() => {
                        queryClient.prefetchQuery({
                          queryKey: ["user-result", result.id],
                          queryFn: async () => {
                            const res = await fetch(`/api/user/results/${result.id}`);
                            if (!res.ok) throw new Error("Erreur");
                            return res.json();
                          },
                          staleTime: 5 * 60 * 1000,
                        });
                      }}
                      className="bg-slate-50 hover:bg-white border-slate-200 text-slate-600 hover:text-emerald-600 font-semibold group transition-all"
                    >
                      Voir le détail
                      <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
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
