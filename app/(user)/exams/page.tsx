"use client";

import React from "react";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Clock,
  CheckCircle,
  Play,
  BarChart3,
  Filter,
  X,
  ChevronRight,
  Calendar,
  EyeOff,
  Lock,
  Sunrise,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SkeletonCard, SkeletonStats } from "@/components/SkeletonLoader";
import { CountdownTimer } from "@/components/CountdownTimer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import {
  APP_TIMEZONE_LABEL,
  formatAppDateTime,
  formatAppLongDate,
  getScheduleView,
  type ScheduleView,
} from "@/lib/exams/schedule-ui";

export default function UserExamsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState<"OFFICIAL" | "MOCK">("OFFICIAL");

  const { data, isLoading } = useQuery({
    queryKey: ["user-exams", tab],
    queryFn: async () => {
      return apiFetch<{
        exams: Array<{
          id: string;
          submissionId?: string;
          examName: string;
          examDescription: string | null;
          status: string;
          score: number;
          maxScore: number;
          passingScore: number;
          startedAt: string | null;
          completedAt: string | null;
          duration: string;
          questionCount: number;
          type: string;
          isAvailable: boolean;
          scheduledAt: string | null;
          /** Jour d'ouverture, stocké en UTC. Repli : déduit de `scheduledAt`. */
          opensOn?: string | null;
        }>;
        stats: {
          total: number;
          available: number;
          completed: number;
          inProgress: number;
          passed: number;
        };
      }>(`/api/user/exams?type=${tab}`);
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch scheduled exams for countdown
  const { data: scheduledData, isLoading: scheduledLoading } = useQuery({
    queryKey: ["scheduled-exams", "OFFICIAL"],
    queryFn: async () => {
      return apiFetch<{
        exams: Array<{
          id: string;
          name?: string | null;
          title?: string | null;
          /**
           * Contenu de l'épreuve. Absent avant l'ouverture : c'est le serveur
           * qui filtre, l'interface se contente de ne rien afficher de vide.
           */
          description?: string | null;
          scheduledAt: string;
          opensOn?: string | null;
          isAvailable?: boolean | null;
          status: string;
          duration?: number | null;
        }>;
      }>("/api/exams/scheduled?type=OFFICIAL");
    },
    staleTime: 60 * 1000, // Update every minute for countdown
  });

  // Examens déjà affichés par la section CountdownTimer (annonce à venir)
  const scheduledIds = new Set(
    (scheduledData?.exams ?? []).map((exam: { id: string }) => exam.id),
  );

  const filteredExams = data?.exams?.filter((exam: any) => {
    if (statusFilter !== "all" && exam.status !== statusFilter.toUpperCase()) {
      return false;
    }
    // Évite le doublon : les examens à venir officiels ont déjà leur carte countdown.
    if (tab === "OFFICIAL" && scheduledIds.has(exam.id)) return false;
    return true;
  });

  /**
   * Une carte « disponible » dont l'heure de démarrage n'est pas atteinte est
   * une carte VERRROUILLÉE : pas de description, pas de durée, pas de nombre de
   * questions, pas de lien. Les cartes terminées ou en cours de correction ne
   * sont jamais concernées — leur contenu est déjà connu du candidat.
   */
  const isLockedCard = (exam: any): boolean => {
    if (exam.status !== "AVAILABLE") return false;
    return !getScheduleView(exam, new Date()).canStart;
  };

  const getSchedule = (exam: any): ScheduleView =>
    getScheduleView(exam, new Date());

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "SUBMITTED":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "AVAILABLE":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "Terminé";
      case "SUBMITTED":
        return "En correction";
      case "IN_PROGRESS":
        return "En cours";
      case "AVAILABLE":
        return "Disponible";
      default:
        return status;
    }
  };

  const getActionLabel = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "Voir résultats";
      case "SUBMITTED":
        return "Voir le statut";
      case "IN_PROGRESS":
        return "Reprendre";
      case "AVAILABLE":
        return "Commencer";
      default:
        return "Voir";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <SkeletonStats />
        <Card className="p-4 bg-white animate-pulse h-16" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Onglets Officiel / Blanc — `tablist` réel : deux boutons qui
          co-varient le contenu ne sont pas deux boutons, c'est un seul
          contrôle à deux états. */}
      <div
        role="tablist"
        aria-label="Type d'examen"
        className="flex w-fit items-center gap-1.5 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm"
      >
        {[
          { key: "OFFICIAL", label: "Examens officiels" },
          { key: "MOCK", label: "Examens blancs" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key as "OFFICIAL" | "MOCK");
              setStatusFilter("all");
            }}
            className={`h-10 rounded-xl px-5 text-xs font-black uppercase tracking-wider transition-all ${
              tab === t.key
                ? "bg-brand text-white shadow-md shadow-brand/25"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4 bg-white shadow-sm">
          <p className="text-sm text-slate-500">Total</p>
          <p className="text-2xl font-bold text-slate-800">
            {data?.stats?.total || 0}
          </p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-slate-500">
          <p className="text-sm text-slate-500">Disponibles</p>
          <p className="text-2xl font-bold text-slate-600">
            {data?.stats?.available || 0}
          </p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
          <p className="text-sm text-slate-500">En cours</p>
          <p className="text-2xl font-bold text-blue-600">
            {data?.stats?.inProgress || 0}
          </p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-sm text-slate-500">Terminés</p>
          <p className="text-2xl font-bold text-emerald-600">
            {data?.stats?.completed || 0}
          </p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-purple-500">
          <p className="text-sm text-slate-500">Réussis</p>
          <p className="text-2xl font-bold text-purple-600">
            {data?.stats?.passed || 0}
          </p>
        </Card>
        {/* Toujours rendu, même à zéro : une carte qui apparaît et disparaît
            selon le chargement décale toute la ligne sous elle. */}
        {tab === "OFFICIAL" && (
          <Card className="border-l-4 border-l-brand bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Programmés</p>
            <p className="text-2xl font-bold text-brand">
              {scheduledData?.exams?.length ?? 0}
            </p>
          </Card>
        )}
      </div>

      {/* ✅ SCHEDULED EXAMS: Countdown Section */}
      {tab === "OFFICIAL" && scheduledLoading && (
        // Réservoir de la même hauteur que la section réelle : pas de saut de
        // mise en page quand les cartes arrivent.
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2" aria-hidden="true">
          {[1, 2].map((i) => (
            <Card key={i} className="h-72 animate-pulse bg-white shadow-sm" />
          ))}
        </div>
      )}
      {tab === "OFFICIAL" &&
        !scheduledLoading &&
        scheduledData?.exams &&
        scheduledData.exams.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Examens Programmés
                </h2>
                <p className="text-sm text-slate-500">
                  {scheduledData.exams.length} examen(s) à venir
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Les horaires sont donnés en {APP_TIMEZONE_LABEL}, heure de référence
              de la plateforme.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scheduledData.exams.map((exam) => (
                <CountdownTimer
                  key={exam.id}
                  scheduledAt={exam.scheduledAt}
                  opensOn={exam.opensOn ?? null}
                  isAvailable={exam.isAvailable ?? null}
                  examId={exam.id}
                  examName={exam.name || exam.title || "Examen programmé"}
                  examDescription={exam.description ?? null}
                  duration={exam.duration ?? null}
                />
              ))}
            </div>
          </div>
        )}

      {/* Filter */}
      <Card className="bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {/* `Filter` est décoratif : le libellé est porté par le `<span>`. */}
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Filtrer par statut
          </span>
          {/* Le `<Select>` de Radix n'est pas un `<select>` natif : sans
              `aria-label`, le lecteur d'écran annonce « combo box » sans
              dire sur quoi elle porte. */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-44" aria-label="Filtrer les examens par statut">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="AVAILABLE">Disponibles</SelectItem>
              <SelectItem value="IN_PROGRESS">En cours</SelectItem>
              <SelectItem value="SUBMITTED">En correction</SelectItem>
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
            <p className="text-lg font-medium text-slate-600">
              Aucun examen trouvé
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {statusFilter !== "all"
                ? "Essayez de modifier vos filtres"
                : "Les examens disponibles apparaîtront ici"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredExams.map((exam: any) => {
            // Une seule source de vérité pour le verrouillage de la carte.
            const schedule = getSchedule(exam);
            const locked = isLockedCard(exam);
            return (
            <Card
              key={exam.id}
              className="p-6 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-brand to-brand-accent flex items-center justify-center flex-shrink-0 shadow-md">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-brand transition-colors">
                        {exam.examName}
                      </h3>
                      {locked ? (
                        // Avant l'ouverture : ni description, ni barème, ni
                        // durée, ni nombre de questions. On dit seulement
                        // QUAND le contenu sera accessible.
                        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500 mt-1.5">
                          <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Détails disponibles dès l&apos;ouverture
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                          {exam.examDescription ||
                            "Aucune description disponible pour cet examen."}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 sm:mt-1 flex flex-col gap-2 items-end">
                    <Badge
                      className={`${locked ? "bg-blue-100 text-blue-700 border-blue-200" : getStatusBadgeColor(exam.status)} px-3 py-1 shadow-sm font-medium`}
                    >
                      {locked ? "Bientôt disponible" : getStatusLabel(exam.status)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`${exam.type === "MOCK" ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-amber-50 text-amber-600 border-amber-100"} p-0 px-2 text-[10px] font-black uppercase`}
                    >
                      {exam.type === "MOCK" ? "BLANC" : "OFFICIEL"}
                    </Badge>
                  </div>
                </div>

                {/* Info — durée et nombre de questions restent masqués avant
                    l'ouverture, même si l'API les glisse dans la réponse. */}
                {locked ? (
                  <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-500">
                    <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    Épreuve non ouverte : durée et barème communiqué à l&apos;ouverture
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
                      <span>{exam.duration || "Illimité"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <BarChart3 className="w-4 h-4 text-slate-400" aria-hidden="true" />
                      <span>{exam.questionCount || 0} questions</span>
                    </div>
                  </div>
                )}

                {/* Date/heure planifiée (annonce à venir) */}
                {exam.scheduledAt && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    <span>
                      {/* Heure Africa/Porto-Novo : la machine de l'admin et celle
                          du candidat n'ont pas le même fuseau. */}
                      {formatAppDateTime(exam.scheduledAt)}
                      <span className="ml-1.5 text-xs text-slate-400">
                        (Porto-Novo)
                      </span>
                    </span>
                  </div>
                )}

                {/* Score if completed */}
                {exam.status === "COMPLETED" && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm font-medium text-slate-700">
                          Score obtenu
                        </span>
                      </div>
                      <span
                        className={`text-2xl font-bold ${(exam.maxScore > 0 ? (exam.score / exam.maxScore) * 100 : 0) >= (exam.passingScore ?? 65) ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {exam.maxScore > 0
                          ? Math.round((exam.score / exam.maxScore) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                )}

                {/* En attente de correction */}
                {exam.status === "SUBMITTED" && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">
                        En attente de correction par l&apos;administration
                      </span>
                    </div>
                  </div>
                )}

                {/* Ouverture : la seule information utile avant le jour J. */}
                {locked && schedule.opensAt && (
                  <p
                    id={`opens-${exam.id}`}
                    className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-900"
                  >
                    <Sunrise className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      Ouverture le{" "}
                      <strong className="font-bold">
                        {formatAppLongDate(schedule.opensAt)}
                      </strong>{" "}
                      à minuit ({APP_TIMEZONE_LABEL}).
                    </span>
                  </p>
                )}

                {/* Actions */}
                {/* Lien seul, sans bouton imbriqué : deux éléments
                    interactifs l'un dans l'autre sont un nœud que le clavier
                    ne sait pas focuser. Le style vient de `buttonVariants`. */}
                <div className="flex gap-2 pt-3 border-t">
                  {locked ? (
                    <Button
                      disabled
                      aria-describedby={
                        schedule.opensAt ? `opens-${exam.id}` : undefined
                      }
                      className="w-full cursor-not-allowed gap-2 bg-slate-200 font-semibold text-slate-400"
                    >
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      Accès verrouillé
                    </Button>
                  ) : (
                  <Link
                    href={
                      exam.status === "COMPLETED" || exam.status === "SUBMITTED"
                        ? `/results/${exam.submissionId}`
                        : `/exams/${exam.id}`
                    }
                    className={buttonVariants({
                      variant: exam.status === "AVAILABLE" ? "default" : "outline",
                      className: "group w-full gap-2",
                    })}
                    onMouseEnter={() => {
                        if (
                          exam.status !== "COMPLETED" &&
                          exam.status !== "SUBMITTED"
                        ) {
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
                              const res = await fetch(
                                `/api/user/results/${exam.submissionId}`,
                              );
                              return res.json();
                            },
                            staleTime: 5 * 60 * 1000,
                          });
                        }
                    }}
                  >

                    {exam.status === "AVAILABLE" ? (
                      <>
                        <Play className="w-4 h-4" aria-hidden="true" />
                        Commencer
                      </>
                    ) : exam.status === "IN_PROGRESS" ? (
                      <>
                        <Play className="w-4 h-4" aria-hidden="true" />
                        Reprendre
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4" aria-hidden="true" />
                        Voir mes notes
                      </>
                    )}
                    <ChevronRight
                      className="ml-auto h-4 w-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </Link>
                  )}
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
