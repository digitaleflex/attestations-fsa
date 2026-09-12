"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ArrowLeft,
  Save,
  Upload,
  Trash2,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  User,
  ExternalLink,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";

interface Scan {
  id: string;
  url: string;
  pageNumber: number;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
}

interface Question {
  id: string;
  text: string;
  type: string;
  points: number;
  order: number;
  options: QuestionOption[];
}

interface ExamPart {
  id: string;
  title: string;
  type: string;
  points: number;
  order: number;
  questions: Question[];
}

interface Exam {
  id: string;
  name: string;
  title: string;
  type: string;
  passingScore: number;
  showResults: boolean;
  totalPoints: number;
  part1Enabled: boolean;
  part2Enabled: boolean;
  part3Enabled: boolean;
  part1Points: number;
  part2Points: number;
  part3Points: number;
  parts: ExamPart[];
}

interface Submission {
  id: string;
  status: string;
  scorePart1: number;
  scorePart2: number | null;
  scorePart3: number | null;
  totalScore: number;
  finalScore: number;
  internshipScore: number;
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  answers: Record<string, unknown> | null;
  candidate: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
  exam: Exam;
  scans: Scan[];
}

interface CorrectResponse {
  message?: string;
  success?: boolean;
  passed?: boolean;
  attestationGenerated?: boolean;
  attestationCode?: string;
  attestationError?: string;
  error?: string;
}

interface UploadResponse {
  message?: string;
  error?: string;
}

const ALLOWED_SCAN_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SCAN_SIZE = 5 * 1024 * 1024;
const MAX_SCAN_FILES = 10;

function normalizeAnswer(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") return value ? [value] : [];
  return [String(value)];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isImageScan(scan: Scan): boolean {
  const name = scan.fileName.toLowerCase();
  return name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png");
}

function statusBadge(status: string) {
  if (status === "GRADED" || status === "COMPLETED") {
    return (
      <Badge className="border-none bg-emerald-100 text-emerald-700 font-bold">
        Corrigé
      </Badge>
    );
  }
  if (status === "PENDING_REVIEW") {
    return (
      <Badge className="border-none bg-amber-100 text-amber-700 font-bold">
        À corriger
      </Badge>
    );
  }
  return (
    <Badge className="border-none bg-slate-100 text-slate-600 font-bold">
      {status}
    </Badge>
  );
}

export default function AdminSubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingScanId, setDeletingScanId] = useState<string | null>(null);

  const [part2Score, setPart2Score] = useState("");
  const [part3Score, setPart3Score] = useState("");
  const [internshipScore, setInternshipScore] = useState("0");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyScores = useCallback((data: Submission) => {
    setPart2Score(data.scorePart2 == null ? "" : String(data.scorePart2));
    setPart3Score(data.scorePart3 == null ? "" : String(data.scorePart3));
    setInternshipScore(String(data.internshipScore ?? 0));
  }, []);

  const fetchSubmission = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`);
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = (await res.json()) as Submission;
      setSubmission(data);
      applyScores(data);
    } catch {
      toast.error("Impossible de charger la copie");
      setSubmission(null);
    } finally {
      setLoading(false);
    }
  }, [id, applyScores]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  const handleCorrect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !submission) return;
    setSaving(true);
    try {
      const payload: Record<string, number | null> = {
        internshipScore: Number(internshipScore) || 0,
      };
      if (submission.exam.part2Enabled) {
        payload.part2Score = part2Score === "" ? null : Number(part2Score);
      }
      if (submission.exam.part3Enabled) {
        payload.part3Score = part3Score === "" ? null : Number(part3Score);
      }

      const res = await fetch(`/api/admin/submissions/${id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as CorrectResponse;

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la correction");
      }

      if (data.attestationGenerated) {
        toast.success(
          `Correction enregistrée. Attestation générée${data.attestationCode ? ` (${data.attestationCode})` : ""}.`
        );
      } else if (data.attestationError) {
        toast.warning(`Correction enregistrée, mais attestation non générée : ${data.attestationError}`);
      } else {
        toast.success("Correction enregistrée avec succès.");
      }

      await fetchSubmission();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id) return;
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (files.length > MAX_SCAN_FILES) {
      toast.error(`Maximum ${MAX_SCAN_FILES} fichiers par envoi.`);
      return;
    }

    for (const file of files) {
      if (!ALLOWED_SCAN_TYPES.includes(file.type)) {
        toast.error(`Type non autorisé : ${file.name}`);
        return;
      }
      if (file.size > MAX_SCAN_SIZE) {
        toast.error(`Fichier trop volumineux : ${file.name} (max 5 Mo).`);
        return;
      }
    }

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("scans", file));

      const res = await fetch(`/api/admin/submissions/${id}/scans`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as UploadResponse;
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'upload");

      toast.success(data.message || "Scan(s) ajouté(s).");
      await fetchSubmission();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteScan = async (scan: Scan) => {
    if (!id) return;
    if (!window.confirm(`Supprimer le scan « ${scan.fileName} » ?`)) return;
    setDeletingScanId(scan.id);
    try {
      const res = await fetch(
        `/api/admin/submissions/${id}/scans?scanId=${encodeURIComponent(scan.id)}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as UploadResponse;
      if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression");
      toast.success("Scan supprimé.");
      await fetchSubmission();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setDeletingScanId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold">Chargement de la copie...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-10">
        <Card className="p-16 text-center border-dashed border-2 border-slate-200 bg-slate-50">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold mb-6">Copie introuvable.</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/admin/submissions">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux copies
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { exam, candidate } = submission;
  const maxScore =
    (exam.part1Enabled ? exam.part1Points : 0) +
      (exam.part2Enabled ? exam.part2Points : 0) +
      (exam.part3Enabled ? exam.part3Points : 0) || exam.totalPoints || 100;
  const scans = [...submission.scans].sort((a, b) => a.pageNumber - b.pageNumber);
  const answers = submission.answers ?? {};

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-3 text-slate-500">
            <Link href="/admin/submissions">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux copies
            </Link>
          </Button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {exam.name || exam.title}
          </h1>
          <div className="flex items-center gap-3">{statusBadge(submission.status)}</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card className="px-5 py-3 border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Score total
            </p>
            <p className="text-xl font-black text-slate-900">
              {Math.round(submission.totalScore * 100) / 100}
              <span className="text-slate-400 text-base">/{maxScore}</span>
            </p>
          </Card>
          <Card className="px-5 py-3 border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Moyenne
            </p>
            <p className="text-xl font-black text-slate-900">
              {submission.status === "GRADED" || submission.status === "COMPLETED"
                ? `${submission.finalScore.toFixed(2)}%`
                : "--"}
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidat */}
        <Card className="p-6 border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="font-black text-slate-900">Candidat</h2>
          </div>
          <p className="font-bold text-slate-900">{candidate.name || "Candidat"}</p>
          <p className="text-sm text-slate-500">{candidate.email}</p>
          {candidate.phone && (
            <p className="text-sm text-slate-500">{candidate.phone}</p>
          )}
          <p className="text-xs text-slate-400 mt-3">
            Soumis le{" "}
            {submission.submittedAt
              ? new Date(submission.submittedAt).toLocaleString("fr-FR")
              : "—"}
          </p>
        </Card>

        {/* Scores par partie */}
        <Card className="p-6 border-slate-100 shadow-sm lg:col-span-2">
          <h2 className="font-black text-slate-900 mb-4">Scores par partie</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Partie 1 (QCM)
              </p>
              <p className="text-lg font-black text-slate-900">
                {submission.scorePart1}
                <span className="text-slate-400 text-sm">/{exam.part1Points}</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Correction automatique</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Partie 2
              </p>
              <p className="text-lg font-black text-slate-900">
                {submission.scorePart2 == null ? "—" : submission.scorePart2}
                <span className="text-slate-400 text-sm">/{exam.part2Points}</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {exam.part2Enabled ? "Correction manuelle" : "Désactivée"}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Partie 3
              </p>
              <p className="text-lg font-black text-slate-900">
                {submission.scorePart3 == null ? "—" : submission.scorePart3}
                <span className="text-slate-400 text-sm">/{exam.part3Points}</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {exam.part3Enabled ? "Correction manuelle" : "Désactivée"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Formulaire de correction */}
      <Card className="p-6 border-slate-100 shadow-sm">
        <h2 className="font-black text-slate-900 mb-6">Correction manuelle</h2>
        <form onSubmit={handleCorrect} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-600 font-bold">Partie 1 (lecture)</Label>
              <Input
                value={submission.scorePart1}
                readOnly
                disabled
                className="h-11 rounded-xl bg-slate-50 border-slate-200"
              />
              <p className="text-[10px] text-slate-400">
                Max {exam.part1Points} pts — corrigé automatiquement
              </p>
            </div>

            {exam.part2Enabled && (
              <div className="space-y-2">
                <Label className="text-slate-600 font-bold">Partie 2</Label>
                <Input
                  type="number"
                  min={0}
                  max={exam.part2Points}
                  step="0.5"
                  value={part2Score}
                  onChange={(e) => setPart2Score(e.target.value)}
                  className="h-11 rounded-xl bg-white border-slate-200"
                />
                <p className="text-[10px] text-slate-400">Max {exam.part2Points} pts</p>
              </div>
            )}

            {exam.part3Enabled && (
              <div className="space-y-2">
                <Label className="text-slate-600 font-bold">Partie 3</Label>
                <Input
                  type="number"
                  min={0}
                  max={exam.part3Points}
                  step="0.5"
                  value={part3Score}
                  onChange={(e) => setPart3Score(e.target.value)}
                  className="h-11 rounded-xl bg-white border-slate-200"
                />
                <p className="text-[10px] text-slate-400">Max {exam.part3Points} pts</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-600 font-bold">Note de stage</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={internshipScore}
                onChange={(e) => setInternshipScore(e.target.value)}
                className="h-11 rounded-xl bg-white border-slate-200"
              />
              <p className="text-[10px] text-slate-400">Sur 100</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="h-11 rounded-xl font-bold bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer la correction
            </Button>
          </div>
        </form>
      </Card>

      {/* Réponses */}
      <Card className="p-6 border-slate-100 shadow-sm">
        <h2 className="font-black text-slate-900 mb-6">Réponses du candidat</h2>
        {exam.parts.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune structure de questions disponible.</p>
        ) : (
          <div className="space-y-8">
            {exam.parts
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((part) => (
                <div key={part.id} className="space-y-4">
                  <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">
                    {part.order}. {part.title}
                    <span className="text-slate-400 font-medium text-sm ml-2">
                      ({part.points} pts)
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {part.questions
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((question) => {
                        // #128 — partie 3 : la composition est stockée sous la clé
                        // "part3" (une zone de rédaction pour tout le cas pratique),
                        // pas sous l'id de chaque question → fallback pour que
                        // l'admin voie la réponse à corriger.
                        const rawAnswer =
                          answers[question.id] ??
                          (part.type === "CASE_STUDY" ? answers.part3 : undefined);
                        const selectedIds = normalizeAnswer(rawAnswer);
                        const answerText =
                          selectedIds.length === 0
                            ? "—"
                            : selectedIds
                                .map(
                                  (optionId) =>
                                    question.options.find((o) => o.id === optionId)?.text ??
                                    optionId
                                )
                                .join(", ");
                        const correctText = question.options
                          .filter((o) => o.isCorrect)
                          .map((o) => o.text)
                          .join(", ");

                        return (
                          <div
                            key={question.id}
                            className="p-4 rounded-2xl bg-slate-50 border border-slate-100"
                          >
                            <p className="text-sm font-bold text-slate-800 mb-2">
                              {question.text}
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                              <span className="font-bold text-slate-500 uppercase tracking-wider">
                                Réponse :
                              </span>
                              <span className="text-slate-800 font-medium">
                                {answerText}
                              </span>
                              {question.options.length > 0 && correctText && (
                                <span className="sm:ml-auto text-emerald-700 font-medium">
                                  Attendu : {correctText}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Scans */}
      <Card className="p-6 border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-black text-slate-900 flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-slate-400" />
              Scans de composition
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              PDF, JPG ou PNG — 5 Mo max par fichier, {MAX_SCAN_FILES} fichiers max.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-11 rounded-xl font-bold border-slate-200"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Ajouter des scans
          </Button>
        </div>

        {scans.length === 0 ? (
          <div className="p-12 text-center border-dashed border-2 border-slate-200 rounded-2xl bg-slate-50">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-bold text-sm">Aucun scan pour cette copie.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm group"
              >
                <div className="h-40 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {isImageScan(scan) ? (
                    <img
                      src={scan.url}
                      alt={scan.fileName}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <FileText className="w-12 h-12 text-slate-300" />
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {isImageScan(scan) ? (
                      <ImageIcon className="w-3.5 h-3.5" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    <span className="truncate font-medium">{scan.fileName}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Page {scan.pageNumber} · {formatFileSize(scan.fileSize)}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-lg text-xs"
                    >
                      <a href={scan.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Voir
                      </a>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={deletingScanId === scan.id}
                      onClick={() => handleDeleteScan(scan)}
                      className="rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      {deletingScanId === scan.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Résumé attestation */}
      {submission.status === "GRADED" && (
        <Card className="p-5 border-slate-100 shadow-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <p className="text-sm font-bold text-slate-700">
            Copie corrigée le{" "}
            {submission.gradedAt
              ? new Date(submission.gradedAt).toLocaleString("fr-FR")
              : "—"}
          </p>
        </Card>
      )}
    </div>
  );
}
