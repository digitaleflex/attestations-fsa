"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Printer, Loader2, GraduationCap, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TranscriptExamResult {
  id: string;
  examName: string;
  totalScore: number;
  totalPoints: number;
  internshipScore: number;
  finalScore: number | null;
  passingScore: number;
  passed: boolean;
  status: string;
  type: string;
  date: string;
  part1Score?: number;
  part2Score?: number;
  part3Score?: number;
  maxPart1?: number;
  maxPart2?: number;
  maxPart3?: number;
}

interface TranscriptAttestation {
  formationName: string;
  type: string;
  code: string;
  issuedAt: string;
  score?: number;
}

interface TranscriptResponse {
  user: {
    fullName: string;
    birthDate: string | null;
    birthPlace: string;
    email: string;
  };
  examResults: TranscriptExamResult[];
  attestations: TranscriptAttestation[];
  stats: {
    globalAverage: number;
    totalExams: number;
    passedExams: number;
    successRate: number;
  };
  isOwner: boolean;
}

function formatDateFr(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function TranscriptPage() {
  const router = useRouter();

  const { data, isLoading, isError } = useQuery<TranscriptResponse>({
    queryKey: ["user-transcript"],
    queryFn: async () => {
      const res = await fetch("/api/user/transcript");
      if (res.status === 401) {
        router.push("/auth");
        throw new Error("Non autorisé");
      }
      if (!res.ok) throw new Error("Erreur lors du chargement du relevé");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="rounded-2xl border border-rose-100 bg-rose-50/50 p-10 text-center">
        <p className="text-rose-700 font-semibold">
          Impossible de charger votre relevé de notes.
        </p>
      </Card>
    );
  }

  const { user, examResults, attestations, stats } = data;

  return (
    <div className="space-y-6">
      {/* Barre d'action (non imprimée) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
            Relevé de notes
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Votre parcours académique officiel, certifié par la direction.
          </p>
        </div>
        <Button
          onClick={() => window.print()}
          className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-11 px-6 font-bold gap-2"
        >
          <Printer className="w-4 h-4" />
          Imprimer / PDF
        </Button>
      </div>

      {/* Document */}
      <Card
        id="transcript-document"
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        {/* En-tête officiel */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
                Ferme Agro-Piscicole Cité St André
              </h2>
              <p className="text-white/80 text-sm font-medium">
                Relevé de notes officiel — Abomey-Calavi, Bénin
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Identité + stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                Candidat
              </h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="text-slate-400 font-medium w-28">Nom</dt>
                  <dd className="font-bold text-slate-800">{user.fullName}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400 font-medium w-28">Email</dt>
                  <dd className="font-semibold text-slate-700">
                    {user.email || "—"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400 font-medium w-28">Né(e) le</dt>
                  <dd className="font-semibold text-slate-700">
                    {formatDateFr(user.birthDate)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400 font-medium w-28">
                    Lieu de naissance
                  </dt>
                  <dd className="font-semibold text-slate-700">
                    {user.birthPlace || "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                Synthèse
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-2xl font-black text-emerald-600">
                    {stats.globalAverage}%
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    Moyenne
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-2xl font-black text-slate-800">
                    {stats.passedExams}/{stats.totalExams}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    Réussis
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-2xl font-black text-blue-600">
                    {stats.successRate}%
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    Taux
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tableau des examens */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              Résultats aux examens
            </h3>
            {examResults.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4">
                Aucun résultat d&apos;examen enregistré.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-left">
                      <th className="py-2 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Matière / Examen
                      </th>
                      <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Date
                      </th>
                      <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                        Note
                      </th>
                      <th className="py-2 pl-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {examResults.map((r) => {
                      // Notes basées sur finalScore (%), seuil passingScore.
                      const pct =
                        r.finalScore === null || r.finalScore === undefined
                          ? null
                          : Math.round(r.finalScore);
                      const passed = pct !== null && r.passed;
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-3 pr-4">
                            <p className="font-bold text-slate-800">
                              {r.examName}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              {r.type === "MOCK" ? "Examen blanc" : "Officiel"}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {formatDateFr(r.date)}
                          </td>
                          <td
                            className={cn(
                              "py-3 px-3 text-right font-black",
                              pct === null
                                ? "text-slate-400"
                                : passed
                                  ? "text-emerald-600"
                                  : "text-rose-600",
                            )}
                          >
                            {pct === null ? "—" : `${pct}%`}
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <Badge
                              className={cn(
                                "rounded-full border-none text-[9px] font-black uppercase tracking-wider",
                                pct === null
                                  ? "bg-amber-50 text-amber-700"
                                  : passed
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700",
                              )}
                            >
                              {pct === null
                                ? "En correction"
                                : passed
                                  ? "Validé"
                                  : "Ajourné"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Attestations */}
          {attestations.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                Certifications délivrées
              </h3>
              <div className="space-y-2">
                {attestations.map((att, index) => (
                  <div
                    key={`${att.code}-${index}`}
                    className="flex items-center justify-between gap-4 bg-slate-50/70 rounded-xl p-4 border border-slate-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">
                          {att.formationName}
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          {att.type} · {formatDateFr(att.issuedAt)}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-500 shrink-0">
                      {att.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pied */}
          <div className="pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400">
              Document généré automatiquement — Ferme Agro-Piscicole Cité St
              André.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
