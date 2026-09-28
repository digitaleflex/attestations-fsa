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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CandidateEmptyState,
  CandidateErrorState,
  CandidateLoading,
  ScoreProgressBar,
} from "@/components/CandidateStates";
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

  const { data, isLoading, isError, isFetching, refetch } =
    useQuery<ResultsResponse>({
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
          <p className="text-slate-600 text-sm font-medium mt-1">
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
        <CandidateLoading
          label="Chargement de vos résultats…"
          className="py-16 justify-center"
        />
      ) : isError ? (
        <CandidateErrorState
          onRetry={() => {
            void refetch();
          }}
          isRetrying={isFetching}
          title="Impossible de charger vos résultats"
          description="Vérifiez votre connexion internet puis relancez le chargement. Vos résultats n'ont pas été perdus."
        />
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
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
            <CandidateEmptyState
              icon={<Trophy className="h-8 w-8 text-slate-500" aria-hidden="true" />}
              title="Aucun résultat pour le moment"
              description="Vous n'avez pas encore passé d'examen. Une fois votre copie corrigée, vos notes apparaîtront ici."
              primaryAction={{
                label: "Voir les examens disponibles",
                onClick: () => router.push("/exams"),
              }}
            />
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
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" aria-hidden="true" />
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
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
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

                      {/* Barre de progression (exposée aux lecteurs d'écran) */}
                      <ScoreProgressBar
                        value={pct}
                        label={`Progression globale de ${result.examName}`}
                        className="mt-5"
                        indicatorClassName={cn(
                          !isGraded
                            ? "bg-amber-400"
                            : !gradesVisible
                              ? "bg-slate-400"
                              : passed
                                ? "bg-gradient-to-r from-emerald-600 to-teal-600"
                                : "bg-gradient-to-r from-rose-600 to-orange-600",
                        )}
                      />

                      {/* Détail par partie */}
                      {gradesVisible && parts.length > 0 && (
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {parts.map((part) => (
                            <div
                              key={part.label}
                              className="bg-slate-50/70 rounded-xl p-3 border border-slate-100"
                            >
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
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
