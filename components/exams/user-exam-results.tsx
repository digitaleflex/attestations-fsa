"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Save, FileEdit } from "lucide-react";
import { toast } from "sonner";

type AdminExam = {
  name: string;
  title?: string | null;
  part1Points: number;
  part2Points: number;
  part3Points: number;
  part1Enabled: boolean;
  part2Enabled: boolean;
  part3Enabled: boolean;
  passingScore: number;
  showResults: boolean;
};

type Submission = {
  id: string;
  userId: string;
  status: string;
  scorePart1: number;
  scorePart2: number;
  scorePart3: number;
  internshipScore: number;
  totalScore: number;
  finalScore: number;
  maxScore: number;
  passed: boolean;
  completed: boolean;
  pendingReview: boolean;
  submittedAt: string;
  exam: AdminExam;
};

type CorrectResponse = {
  success: boolean;
  submission: {
    id: string;
    status: string;
    scorePart1: number;
    scorePart2: number;
    scorePart3: number;
    totalScore: number;
    maxScore: number;
    finalScore: number;
    internshipScore: number;
  };
  passed: boolean;
  attestationGenerated: boolean;
  attestationCode?: string;
  attestationError?: string;
};

export function UserExamResults({ userId }: { userId: string }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [gradingData, setGradingData] = useState({
    p1: 0,
    p2: 0,
    p3: 0,
    internship: 0,
  });

  const loadSubmissions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/submissions");
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      const list: Submission[] = Array.isArray(data?.submissions)
        ? data.submissions
        : [];
      setSubmissions(list.filter((s) => s.userId === userId));
    } catch {
      toast.error("Impossible de charger les soumissions");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const handleStartGrading = (s: Submission) => {
    setGradingId(s.id);
    setGradingData({
      p1: s.scorePart1 ?? 0,
      p2: s.scorePart2 ?? 0,
      p3: s.scorePart3 ?? 0,
      internship: s.internshipScore ?? 0,
    });
  };

  const handleSaveGrade = async (id: string) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part1Score: gradingData.p1,
          part2Score: gradingData.p2,
          part3Score: gradingData.p3,
          internshipScore: gradingData.internship,
        }),
      });

      const payload = (await res.json()) as Partial<CorrectResponse> & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(payload?.error || "Erreur lors de l'enregistrement");
      }

      const percent = Math.round(payload.submission?.finalScore ?? 0);
      toast.success(
        payload.attestationGenerated
          ? `Notes enregistrées — ${percent}% · Attestation générée`
          : `Notes enregistrées — ${percent}%${
              payload.passed ? " · Réussi" : ""
            }`,
      );

      setGradingId(null);
      // Rafraîchissement serveur (plus de state local optimiste)
      await loadSubmissions();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'enregistrement",
      );
    } finally {
      setSavingId(null);
    }
  };

  if (loading)
    return <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-300" />;

  if (submissions.length === 0) {
    return (
      <p className="text-center py-4 text-slate-400 text-sm italic">
        Aucun examen passé pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t mt-4">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        Résultats des Examens
      </h3>
      <div className="grid gap-4">
        {submissions.map((s) => {
          const title = s.exam?.name || s.exam?.title || "Examen";
          const isGrading = gradingId === s.id;
          const part2Enabled = s.exam?.part2Enabled !== false;
          const part3Enabled = s.exam?.part3Enabled !== false;
          const mP1 = s.exam?.part1Points ?? 20;
          const mP2 = s.exam?.part2Points ?? 40;
          const mP3 = s.exam?.part3Points ?? 40;
          const columnCount = 1 + (part2Enabled ? 1 : 0) + (part3Enabled ? 1 : 0);
          const liveTotal =
            (gradingData.p1 || 0) +
            (part2Enabled ? gradingData.p2 || 0 : 0) +
            (part3Enabled ? gradingData.p3 || 0 : 0);

          return (
            <Card
              key={s.id}
              className="p-4 bg-slate-50 border-slate-100 relative overflow-hidden group"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{title}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-medium">
                      Soumis le{" "}
                      {new Date(s.submittedAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Badge
                    className={
                      s.completed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }
                  >
                    {s.completed
                      ? "Noté"
                      : s.pendingReview
                        ? "En correction"
                        : "En cours"}
                  </Badge>
                </div>

                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">
                      Partie 1 (QCM)
                    </p>
                    {isGrading ? (
                      <Input
                        type="number"
                        min={0}
                        max={mP1}
                        value={gradingData.p1}
                        onChange={(e) =>
                          setGradingData({
                            ...gradingData,
                            p1: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-7 text-center font-bold text-sm mt-1"
                      />
                    ) : (
                      <p className="font-bold text-slate-700">
                        {s.scorePart1 ?? 0}/{mP1}
                      </p>
                    )}
                  </div>

                  {part2Enabled && (
                    <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">
                        Partie 2 (Ouverte)
                      </p>
                      {isGrading ? (
                        <Input
                          type="number"
                          min={0}
                          max={mP2}
                          value={gradingData.p2}
                          onChange={(e) =>
                            setGradingData({
                              ...gradingData,
                              p2: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-7 text-center font-bold text-sm mt-1"
                        />
                      ) : (
                        <p className="font-bold text-slate-700">
                          {s.scorePart2 ?? 0}/{mP2}
                        </p>
                      )}
                    </div>
                  )}

                  {part3Enabled && (
                    <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">
                        Partie 3 (Cas)
                      </p>
                      {isGrading ? (
                        <Input
                          type="number"
                          min={0}
                          max={mP3}
                          value={gradingData.p3}
                          onChange={(e) =>
                            setGradingData({
                              ...gradingData,
                              p3: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-7 text-center font-bold text-sm mt-1"
                        />
                      ) : (
                        <p className="font-bold text-slate-700">
                          {s.scorePart3 ?? 0}/{mP3}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t pt-3 bg-slate-50 group-hover:bg-slate-100 transition-colors">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-slate-400 font-bold">
                      TOTAL:
                    </span>
                    <span className="text-lg font-black text-primary">
                      {isGrading ? liveTotal : (s.totalScore ?? 0)}/{s.maxScore}
                    </span>
                    {s.completed && !isGrading && (
                      <span className="text-[11px] font-black text-emerald-600">
                        {Math.round(s.finalScore ?? 0)}%
                      </span>
                    )}
                  </div>
                  {isGrading ? (
                    <Button
                      size="sm"
                      className="h-8 gap-2"
                      onClick={() => handleSaveGrade(s.id)}
                      disabled={savingId === s.id}
                    >
                      {savingId === s.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      Enregistrer
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 bg-white"
                      onClick={() => handleStartGrading(s)}
                    >
                      <FileEdit className="w-3 h-3" /> Noter
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
