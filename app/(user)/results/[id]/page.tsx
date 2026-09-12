"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Briefcase,
  Hourglass,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExamBareme {
  maxPart1?: number;
  maxPart2?: number;
  maxPart3?: number;
  totalMax?: number;
}

interface ExamSessionDetail {
  id: string;
  examId: string;
  status: string;
  scorePart1: number | null;
  scorePart2: number | null;
  scorePart3: number | null;
  totalScore: number | null;
  internshipScore: number;
  finalScore: number | null;
  scorePercent: number | null;
  maxScore: number;
  passingScore: number;
  passed: boolean;
  showResults: boolean;
  gradedAt: string | null;
  startedAt: string;
  submittedAt: string | null;
  type: string;
  answers: Record<string, unknown> | null;
  exam: {
    id: string;
    title: string | null;
    name: string | null;
    part1Points: number | null;
    part2Points: number | null;
    part3Points: number | null;
    totalPoints: number | null;
    passingScore: number | null;
    type: string;
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<string, string> = {
  GRADED: "Corrigé",
  COMPLETED: "Corrigé",
  SUBMITTED: "En attente de correction",
  PENDING_REVIEW: "En attente de correction",
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
};

export default function ResultDetailPage() {
  const router = useRouter();
  const rawParams = useParams<{ id: string }>();
  const id = Array.isArray(rawParams?.id) ? rawParams.id[0] : rawParams?.id;

  const { data, isLoading, isError, error } = useQuery<ExamSessionDetail>({
    queryKey: ["user-result", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/user/results/${id}`);
      if (res.status === 401) {
        router.push("/auth");
        throw new Error("Non autorisé");
      }
      if (res.status === 403) throw new Error("Accès refusé");
      if (res.status === 404) throw new Error("Résultat introuvable");
      if (!res.ok) throw new Error("Erreur lors du chargement du résultat");
      return res.json();
    },
  });

  const backButton = (
    <Link href="/results">
      <Button
        variant="outline"
        className="rounded-xl h-11 px-5 font-bold gap-2 border-slate-200"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux résultats
      </Button>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        {backButton}
        <Card className="rounded-2xl border border-rose-100 bg-rose-50/50 p-10 text-center">
          <p className="text-rose-700 font-semibold">
            {error instanceof Error
              ? error.message
              : "Impossible de charger ce résultat."}
          </p>
        </Card>
      </div>
    );
  }

  // #120 — le barème snapshoté est imbriqué sous answers._customBareme
  // (pas à la racine de answers) : sinon on retombe sur la config live
  // de l'examen et score/max devient faux après édition.
  const rawAnswers = data.answers as { _customBareme?: ExamBareme } | null;
  const bareme: ExamBareme = rawAnswers?._customBareme ?? {};
  const maxPart1 = bareme.maxPart1 ?? data.exam.part1Points ?? 20;
  const maxPart2 = bareme.maxPart2 ?? data.exam.part2Points ?? 40;
  const maxPart3 = bareme.maxPart3 ?? data.exam.part3Points ?? 40;
  const passingScore = data.passingScore ?? data.exam.passingScore ?? 65;

  const isCorrected =
    data.status === "GRADED" || data.status === "COMPLETED";
  const showResults = data.showResults !== false;
  const gradesVisible = isCorrected && showResults;
  // Notes fournies par l'API (null tant que masquées / non corrigées).
  const scorePercent = data.scorePercent ?? data.finalScore ?? null;
  const displayScore =
    scorePercent === null
      ? 0
      : Math.max(0, Math.min(100, Math.round(scorePercent)));
  const passed = gradesVisible && data.passed;

  const parts = [
    { label: "Partie 1", score: data.scorePart1, max: maxPart1 },
    { label: "Partie 2", score: data.scorePart2, max: maxPart2 },
    { label: "Partie 3", score: data.scorePart3, max: maxPart3 },
  ].filter((p) => p.max > 0);

  const examTitle = data.exam.title || data.exam.name || "Examen";
  const isMock = (data.type || data.exam.type) === "MOCK";

  return (
    <div className="space-y-6">
      {backButton}

      {/* Carte score principale */}
      <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full p-0 px-3 text-[10px] font-black uppercase tracking-wider",
                    isMock
                      ? "bg-blue-50 text-blue-600 border-blue-100"
                      : "bg-amber-50 text-amber-600 border-amber-100",
                  )}
                >
                  {isMock ? "Blanc" : "Officiel"}
                </Badge>
                <Badge
                  className={cn(
                    "rounded-full border-none text-[10px] font-black uppercase tracking-wider",
                    !isCorrected
                      ? "bg-slate-100 text-slate-600"
                      : !showResults
                        ? "bg-slate-100 text-slate-600"
                        : passed
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700",
                  )}
                >
                  {!isCorrected
                    ? "Non corrigé"
                    : !showResults
                      ? "Notes masquées"
                      : passed
                        ? "Réussi"
                        : "Échoué"}
                </Badge>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight leading-tight">
                {examTitle}
              </h1>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {STATUS_LABELS[data.status] || data.status}
              </p>
            </div>

            <div className="text-center shrink-0">
              {gradesVisible ? (
                <>
                  <p
                    className={cn(
                      "text-5xl font-black tracking-tight",
                      passed ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {displayScore}
                    <span className="text-2xl align-top">%</span>
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Seuil {passingScore}%
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <Hourglass className="w-10 h-10 mb-1" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">
                    {isCorrected && !showResults
                      ? "Notes masquées"
                      : "En correction"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {gradesVisible && (
            <div className="mt-6 h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  passed
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : "bg-gradient-to-r from-rose-500 to-orange-500",
                )}
                style={{
                  width: `${Math.max(0, Math.min(100, displayScore))}%`,
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Détail par partie (masqué si notes non publiées) */}
      {gradesVisible && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {parts.map((part) => {
            const score = part.score ?? 0;
            const pct = part.max > 0 ? Math.round((score / part.max) * 100) : 0;
            return (
              <Card
                key={part.label}
                className="rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {part.label}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {pct}%
                    </span>
                  </div>
                  <p className="text-2xl font-black text-slate-800">
                    {score}
                    <span className="text-base text-slate-400 font-bold">
                      {" "}
                      / {part.max}
                    </span>
                  </p>
                  <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Notes complémentaires */}
      {gradesVisible && (data.internshipScore > 0 || (data.finalScore ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.internshipScore > 0 && (
            <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Note de stage
                  </p>
                  <p className="text-xl font-black text-slate-800">
                    {data.internshipScore}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {(data.finalScore ?? 0) > 0 && (
            <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  {passed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Moyenne globale
                  </p>
                  <p className="text-xl font-black text-slate-800">
                    {Math.round(data.finalScore ?? 0)}%
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dates */}
      <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Chronologie
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Commencé le
              </dt>
              <dd className="font-semibold text-slate-700 mt-1">
                {formatDate(data.startedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Soumis le
              </dt>
              <dd className="font-semibold text-slate-700 mt-1">
                {formatDate(data.submittedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Corrigé le
              </dt>
              <dd className="font-semibold text-slate-700 mt-1">
                {formatDate(data.gradedAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
