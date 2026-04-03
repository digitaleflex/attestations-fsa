"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Keyboard, CloudOff, Cloud } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api-client";

const STORAGE_KEY = "attestation_draft";
const ATTESTATION_TYPES = [
  { value: "FORMATION", label: "Formation" },
  { value: "STAGE", label: "Stage" },
  { value: "CERTIFICATION", label: "Certification" },
];

const GENDER_OPTIONS = [
  { value: "M", label: "Masculin" },
  { value: "F", label: "Féminin" },
];

const DEFAULT_FORM = {
  fullName: "",
  gender: undefined as "M" | "F" | undefined,
  birthDate: "",
  birthPlace: "",
  formation: "",
  startDate: "",
  endDate: "",
  location: "Abomey-Calavi, Bénin",
  instructor: "",
  issuingCompany: "La Ferme Agro Piscicole Cité St André",
  type: "FORMATION" as "FORMATION" | "STAGE" | "CERTIFICATION",
  stageHours: undefined as number | undefined,
  stageScore: undefined as number | undefined,
  stageObservations: "",
  certificationMention: undefined as string | undefined,
  certificationScore: undefined as number | undefined,
  certificationHours: undefined as number | undefined,
  certificationObservations: "",
};

type NewAttestationForm = typeof DEFAULT_FORM;

export default function NewAttestationPage() {
  const [form, setForm] = useState<NewAttestationForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formations, setFormations] = useState<string[]>([]);
  const [completion, setCompletion] = useState(0);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isInitialMount = useRef(true);

  // 1. Charger le brouillon depuis localStorage au montage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...parsed }));
        setIsDraftLoaded(true);
        toast.info("📝 Brouillon restauré automatiquement");
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // 2. Sauvegarder automatiquement dans localStorage à chaque changement
  useEffect(() => {
    // Skip initial mount to avoid saving default form
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Debounce save (500ms)
    const timeout = setTimeout(() => {
      try {
        setIsSaving(true);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
        setIsSaving(false);
      } catch {
        setIsSaving(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [form]);

  // 3. Avertir avant de quitter la page si des données non sauvegardées existent
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasData = form.fullName || form.birthDate || form.formation;
      if (hasData && !success) {
        e.preventDefault();
        e.returnValue = "Des données non sauvegardées seront perdues. Voulez-vous vraiment quitter ?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form, success]);

  // Charger les formations
  useEffect(() => {
    fetch("/api/formations")
      .then((res) => res.json())
      .then((data) => setFormations(Array.isArray(data) ? data.map((f: { name: string }) => f.name) : []))
      .catch(() => setFormations([]));
  }, []);

  // Calculer la progression
  useEffect(() => {
    const requiredFields = ['fullName', 'gender', 'birthDate', 'birthPlace', 'formation', 'startDate', 'endDate', 'location', 'instructor'];
    const filledFields = requiredFields.filter(field => form[field as keyof NewAttestationForm]);
    const percentage = Math.round((filledFields.length / requiredFields.length) * 100);
    setCompletion(percentage);
  }, [form]);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        // Force immediate save
        localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
        toast.success("💾 Brouillon sauvegardé !");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        handleReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelect = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (name: string, value: string) => {
    const numValue = parseInt(value) || undefined;
    setForm((prev) => ({ ...prev, [name]: numValue }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      await apiFetch("/api/attestations", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSuccess(true);
      toast.success("✅ Attestation créée avec succès !");
      // ✅ Supprimer le brouillon après succès
      localStorage.removeItem(STORAGE_KEY);
      handleReset();
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_FORM);
    setSuccess(false);
    setError("");
    // ✅ Supprimer le brouillon
    localStorage.removeItem(STORAGE_KEY);
    toast.info("Formulaire réinitialisé");
  };

  const handleRestoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...parsed }));
        setIsDraftLoaded(true);
        toast.info("📝 Brouillon restauré");
      }
    } catch {
      toast.error("Erreur lors de la restauration du brouillon");
    }
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl">📝</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Nouvelle Attestation</h1>
              <p className="text-sm text-slate-500">Créez une attestation de formation, stage ou certification</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Indicateur de sauvegarde auto */}
            <Badge variant="outline" className="gap-1.5">
              {isSaving ? (
                <>
                  <CloudOff className="w-3 h-3 animate-pulse" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  Brouillon auto-sauvegardé
                </>
              )}
            </Badge>
            <Link href="/admin/attestations">
              <Button variant="outline">← Retour</Button>
            </Link>
          </div>
        </div>

        {/* Barre de progression */}
        <Card className="mb-6 p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Progression du formulaire</span>
            </div>
            <Badge variant={completion === 100 ? "default" : "secondary"}>{completion}%</Badge>
          </div>
          <Progress value={completion} className="h-2" />
        </Card>

        {/* Raccourcis */}
        <Card className="mb-6 p-3 bg-white shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Keyboard className="w-4 h-4" />
            <span>Raccourcis :</span>
            <span className="font-mono bg-slate-100 px-2 py-1 rounded">Ctrl+S</span>
            <span>Sauvegarder le brouillon</span>
            <span className="font-mono bg-slate-100 px-2 py-1 rounded">Ctrl+R</span>
            <span>Réinitialiser</span>
          </div>
        </Card>

        {/* Formulaire */}
        <Card className="p-8 bg-white shadow-lg" suppressHydrationWarning>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-6">
              <AlertTitle>Succès</AlertTitle>
              <AlertDescription>✅ Attestation créée avec succès !</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nom complet */}
            <div>
              <Label htmlFor="fullName">👤 Nom complet *</Label>
              <Input
                id="fullName"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Ex: Koffi Amadou"
                className="mt-1.5 h-11"
              />
            </div>

            {/* Sexe */}
            <div>
              <Label htmlFor="gender">⚥ Sexe *</Label>
              <Select value={form.gender || ""} onValueChange={(v) => handleSelect("gender", v)}>
                <SelectTrigger className="mt-1.5 h-11">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date de naissance */}
            <div>
              <Label htmlFor="birthDate">🎂 Date de naissance *</Label>
              <DateInput
                id="birthDate"
                name="birthDate"
                value={form.birthDate}
                onChange={handleChange}
                className="mt-1.5"
              />
            </div>

            {/* Lieu de naissance */}
            <div>
              <Label htmlFor="birthPlace">📍 Lieu de naissance *</Label>
              <Input
                id="birthPlace"
                name="birthPlace"
                value={form.birthPlace}
                onChange={handleChange}
                placeholder="Ex: Cotonou, Bénin"
                className="mt-1.5 h-11"
              />
            </div>

            {/* Type d'attestation */}
            <div>
              <Label htmlFor="type">📑 Type d'attestation</Label>
              <Select value={form.type} onValueChange={(v) => handleSelect("type", v)}>
                <SelectTrigger className="mt-1.5 h-11">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {ATTESTATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Formation */}
            <div>
              <Label htmlFor="formation">🎓 Formation *</Label>
              <Input
                id="formation"
                name="formation"
                value={form.formation}
                onChange={handleChange}
                placeholder="Nom de la formation"
                className="mt-1.5 h-11"
                list="formations-list"
              />
              <datalist id="formations-list">
                {formations.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {/* Dates */}
            <div>
              <Label htmlFor="startDate">📅 Date de début *</Label>
              <DateInput
                id="startDate"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="endDate">📅 Date de fin *</Label>
              <DateInput
                id="endDate"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="mt-1.5"
              />
            </div>

            {/* Lieu */}
            <div>
              <Label htmlFor="location">📍 Lieu *</Label>
              <Input
                id="location"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Lieu de la formation"
                className="mt-1.5 h-11"
              />
            </div>

            {/* Formateur */}
            <div>
              <Label htmlFor="instructor">👨‍🏫 Formateur *</Label>
              <Input
                id="instructor"
                name="instructor"
                value={form.instructor}
                onChange={handleChange}
                placeholder="Nom du formateur"
                className="mt-1.5 h-11"
              />
            </div>

            {/* Société émettrice */}
            <div className="md:col-span-2">
              <Label htmlFor="issuingCompany">🏢 Société émettrice</Label>
              <Input
                id="issuingCompany"
                name="issuingCompany"
                value={form.issuingCompany}
                onChange={handleChange}
                className="mt-1.5 h-11"
              />
            </div>

            {/* Champs spécifiques STAGE */}
            {form.type === "STAGE" && (
              <>
                <div className="md:col-span-2 mt-4 border-t pt-4">
                  <h3 className="text-lg font-bold text-blue-600 mb-4">📋 Informations de Stage</h3>
                </div>
                <div>
                  <Label htmlFor="stageHours">⏱️ Heures de stage</Label>
                  <Input
                    id="stageHours"
                    name="stageHours"
                    type="number"
                    value={form.stageHours || ""}
                    onChange={(e) => handleNumberChange("stageHours", e.target.value)}
                    placeholder="120"
                    className="mt-1.5 h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="stageScore">📊 Score du stage (0-100)</Label>
                  <Input
                    id="stageScore"
                    name="stageScore"
                    type="number"
                    min="0"
                    max="100"
                    value={form.stageScore || ""}
                    onChange={(e) => handleNumberChange("stageScore", e.target.value)}
                    placeholder="85"
                    className="mt-1.5 h-11"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="stageObservations">💬 Observations du tuteur</Label>
                  <textarea
                    id="stageObservations"
                    name="stageObservations"
                    value={form.stageObservations || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, stageObservations: e.target.value }))}
                    placeholder="Décrivez le déroulement du stage..."
                    className="w-full min-h-[100px] px-4 py-3 rounded-md border border-blue-200 bg-blue-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mt-1.5"
                    maxLength={1000}
                  />
                  <div className="text-right text-xs text-blue-400 mt-1">{form.stageObservations?.length || 0}/1000</div>
                </div>
              </>
            )}

            {/* Champs spécifiques CERTIFICATION */}
            {form.type === "CERTIFICATION" && (
              <>
                <div className="md:col-span-2 mt-4 border-t pt-4">
                  <h3 className="text-lg font-bold text-amber-600 mb-4">🏆 Informations de Certification</h3>
                </div>
                <div>
                  <Label htmlFor="certificationHours">⏱️ Heures de formation</Label>
                  <Input
                    id="certificationHours"
                    name="certificationHours"
                    type="number"
                    value={form.certificationHours || ""}
                    onChange={(e) => handleNumberChange("certificationHours", e.target.value)}
                    placeholder="200"
                    className="mt-1.5 h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="certificationScore">📊 Score (0-100)</Label>
                  <Input
                    id="certificationScore"
                    name="certificationScore"
                    type="number"
                    min="0"
                    max="100"
                    value={form.certificationScore || ""}
                    onChange={(e) => handleNumberChange("certificationScore", e.target.value)}
                    placeholder="90"
                    className="mt-1.5 h-11"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="certificationObservations">💬 Observations du jury</Label>
                  <textarea
                    id="certificationObservations"
                    name="certificationObservations"
                    value={form.certificationObservations || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, certificationObservations: e.target.value }))}
                    placeholder="Évaluez la prestation du candidat..."
                    className="w-full min-h-[100px] px-4 py-3 rounded-md border border-amber-200 bg-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none mt-1.5"
                    maxLength={1000}
                  />
                  <div className="text-right text-xs text-amber-400 mt-1">{form.certificationObservations?.length || 0}/1000</div>
                </div>
              </>
            )}
          </div>

          {/* Footer avec actions */}
          <div className="flex gap-3 mt-8 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={loading}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Réinitialiser
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Création...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Créer l'attestation
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
