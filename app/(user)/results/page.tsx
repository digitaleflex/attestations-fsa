"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Trophy,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExamResult {
  id: string;
  examId: string;
  examName: string;
  examDescription?: string | null;
  status: string;
  passingScore: number;
  scorePart1: number | null;
  scorePart2: number | null;
  scorePart3: number | null;
  internshipScore?: number | null;
  finalScore?: number | null;
  totalScore: number | null;
  maxScore: number;
  scorePercent: number | null;
  maxPart1: number;
  maxPart2: number;
  maxPart3: number;
  passed: boolean;
  completedAt: string | null;
  showResults: boolean;
}

interface ResultsResponse {
  results: ExamResult[];
  stats: {
    totalExams: number;
    passedExams: number;
    failedExams: number;
    averageScore: number;
    bestScore: number;
  };
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function UserResultsPage() {
  const router = useRouter();

  const { data, isLoading, isError } = useQuery<ResultsResponse>({
    queryKey: ["user-results"],
    queryFn: async () => {
      const res = await fetch("/api/user/results");
      if (res.status === 401) {
        router.push("/auth");
        throw new Error("Non autorisé");
      }
      if (!res.ok) {
        throw new Error("Erreur lors du chargement des résultats");
      }
      return res.json();
    },
  });

  const results = data?.results ?? [];
  const stats = data?.stats;

  const statCards = [
    {
      label: "Examens passés",
      value: stats?.totalExams ?? 0,
      icon: BarChart3,
      tone: "text-brand bg-brand/10",
    },
    {
      label: "Réussis",
      value: stats?.passedExams ?? 0,
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Échoués",
      value: stats?.failedExams ?? 0,
      icon: XCircle,
      tone: "text-rose-600 bg-rose-50",
    },
    {
      label: "Moyenne générale",
      value: `${stats?.averageScore ?? 0}%`,
      icon: Target,
      tone: "text-slate-600 bg-slate-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
            Mes Résultats
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Consultez vos notes et votre progression aux examens officiels.
          </p>
        </div>
        <Link href="/exams">
          <Button className="bg-brand hover:bg-brand-dark rounded-xl h-11 px-6 font-bold gap-2">
            Passer un examen
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
        </div>
      ) : isError ? (
        <Card className="rounded-2xl border border-rose-100 bg-rose-50/50 p-10 text-center">
          <p className="text-rose-700 font-semibold">
            Impossible de charger vos résultats. Veuillez réessayer plus tard.
          </p>
        </Card>
      ) : (
        <>
          {/* Statistiques */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <Card
                key={card.label}
                className="rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {card.label}
                    </span>
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center",
                        card.tone,
                      )}
                    >
                      <card.icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-800 tracking-tight">
                    {card.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Liste */}
          {results.length === 0 ? (
            <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                Aucun résultat pour le moment
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Vous n&apos;avez pas encore passé d&apos;examen.
              </p>
              <Link href="/exams">
                <Button className="bg-brand hover:bg-brand-dark rounded-xl h-11 px-6 font-bold gap-2">
                  Voir les examens disponibles
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {results.map((result) => {
                const isGraded =
                  result.status === "GRADED" || result.status === "COMPLETED";
                const gradesVisible = isGraded && result.showResults !== false;
                const rawPercent =
                  result.scorePercent ?? result.finalScore ?? null;
                const pct =
                  rawPercent === null
                    ? 0
                    : Math.max(0, Math.min(100, Math.round(rawPercent)));
                const passed = gradesVisible && result.passed;
                const parts: Array<{
                  label: string;
                  score: number | null;
                  max: number;
                }> = gradesVisible
                  ? [
                      {
                        label: "Partie 1",
                        score: result.scorePart1,
                        max: result.maxPart1,
                      },
                      ...(result.scorePart2 !== null &&
                      result.scorePart2 !== undefined
                        ? [
                            {
                              label: "Partie 2",
                              score: result.scorePart2,
                              max: result.maxPart2,
                            },
                          ]
                        : []),
                      ...(result.scorePart3 !== null &&
                      result.scorePart3 !== undefined
                        ? [
                            {
                              label: "Partie 3",
                              score: result.scorePart3,
                              max: result.maxPart3,
                            },
                          ]
                        : []),
                    ]
                  : [];

                return (
                  <Card
                    key={result.id}
                    className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-800 truncate">
                              {result.examName}
                            </h3>
                            <Badge
                              className={cn(
                                "rounded-full border-none text-[10px] font-black uppercase tracking-wider",
                                !isGraded
                                  ? "bg-amber-50 text-amber-700"
                                  : !gradesVisible
                                    ? "bg-slate-100 text-slate-600"
                                    : passed
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-rose-50 text-rose-700",
                              )}
                            >
                              {!isGraded
                                ? "En correction"
                                : !gradesVisible
                                  ? "Notes masquées"
                                  : passed
                                    ? "Réussi"
                                    : "Échoué"}
                            </Badge>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {formatDate(result.completedAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {gradesVisible ? (
                            <>
                              <p
                                className={cn(
                                  "text-3xl font-black tracking-tight",
                                  passed
                                    ? "text-emerald-600"
                                    : "text-rose-600",
                                )}
                              >
                                {pct}%
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Seuil {result.passingScore}%
                              </p>
                            </>
                          ) : isGraded ? (
                            <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                              Notes masquées
                            </p>
                          ) : (
                            <p className="text-sm font-black uppercase tracking-widest text-amber-600">
                              En attente
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Barre de progression */}
                      <div className="mt-5 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            !isGraded
                              ? "bg-amber-300"
                              : !gradesVisible
                                ? "bg-slate-200"
                                : passed
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                  : "bg-gradient-to-r from-rose-500 to-orange-500",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Détail par partie */}
                      {gradesVisible && parts.length > 0 && (
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {parts.map((part) => (
                            <div
                              key={part.label}
                              className="bg-slate-50/70 rounded-xl p-3 border border-slate-100"
                            >
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                {part.label}
                              </p>
                              <p className="text-sm font-bold text-slate-700">
                                {part.score} / {part.max}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
