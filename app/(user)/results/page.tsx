"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, BarChart3, Calendar, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserResultsPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["user-results"],
    queryFn: async () => {
      const res = await fetch("/api/user/results");
      if (!res.ok) {
        if (res.status === 401) router.push("/admin/login");
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

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
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Mes Résultats</h1>
              <p className="text-xs text-slate-500">Consultez vos notes et feedbacks</p>
            </div>
          </div>
          <Link href="/user/dashboard">
            <Button variant="outline" size="sm">← Retour</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
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
                        {result.correctAnswers}/{result.totalQuestions} correctes
                      </p>
                    </div>
                  </div>

                  {result.categoriesBreakdown && Object.keys(result.categoriesBreakdown).length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Détail par catégorie</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(result.categoriesBreakdown).map(([category, data]: [string, any]) => (
                          <div key={category} className="text-center">
                            <p className="text-xs text-slate-500 mb-1">{category}</p>
                            <p className="text-lg font-bold text-slate-800">
                              {data.correct}/{data.total}
                            </p>
                            <p className="text-xs text-slate-400">
                              {Math.round((data.correct / data.total) * 100)}%
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    <Link href={`/user/results/${result.id}`} className="flex-1">
                      <Button variant="outline" className="w-full gap-2">
                        <BookOpen className="w-4 h-4" />
                        Voir détails
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
