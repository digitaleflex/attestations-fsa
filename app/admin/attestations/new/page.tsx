"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  RotateCcw,
  Keyboard,
  CloudOff,
  Cloud,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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
  email: "",
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
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isInitialMount = useRef(true);

  // 1. Charger le brouillon depuis localStorage au montage
  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...parsed }));
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
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
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
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form, success]);

  // Charger les formations
  useEffect(() => {
    apiFetch("/api/formations", {}, false)
      .then((data) =>
        setFormations(
          Array.isArray(data) ? data.map((f: { name: string }) => f.name) : [],
        ),
      )
      .catch(() => setFormations([]));
  }, []);

  // Calculer la progression
  useEffect(() => {
    const requiredFields = [
      "fullName",
      "gender",
      "birthDate",
      "birthPlace",
      "formation",
      "startDate",
      "endDate",
      "location",
      "instructor",
    ];
    const filledFields = requiredFields.filter(
      (field) => form[field as keyof NewAttestationForm],
    );
    const percentage = Math.round(
      (filledFields.length / requiredFields.length) * 100,
    );
    setCompletion(percentage);
  }, [form]);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        // Force immediate save
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
          toast.success("💾 Brouillon sauvegardé !");
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        handleReset();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
    setFieldErrors({});

    try {
      // Nettoyage des données pour éviter les erreurs Zod
      const submitData = { ...form };

      // Nettoyer les enums optionnels s'ils sont vides
      if (!submitData.gender) delete submitData.gender;
      if (!submitData.certificationMention)
        delete submitData.certificationMention;

      // S'assurer que les nombres vides sont supprimés pour ne pas envoyer "" à un champ Number
      const numericFields = ["passingScore", "totalPoints", "durationMinutes"];
      numericFields.forEach((field) => {
        const val = submitData[field as keyof NewAttestationForm];
        if (
          val === ( "" as unknown as number ) ||
          val === undefined
        ) {
          delete submitData[field as keyof NewAttestationForm];
        }
      });

      await apiFetch("/api/attestations", {
        method: "POST",
        body: JSON.stringify(submitData),
      });
      setSuccess(true);
      toast.success("✅ Attestation créée avec succès !");
      // ✅ Supprimer le brouillon après succès
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      handleReset();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Erreur inconnue");

      // Si on a des détails d'erreur (ex: Zod), on les affiche par champ
      if (
        apiErr instanceof ApiError &&
        apiErr.details &&
        Array.isArray(apiErr.details)
      ) {
        const errors: Record<string, string> = {};
        apiErr.details.forEach((detail: { path?: string[]; message: string }) => {
          if (detail.path && detail.path.length > 0) {
            const fieldName = detail.path[0];
            errors[fieldName] = detail.message;
          }
        });
        setFieldErrors(errors);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_FORM);
    setSuccess(false);
    setError("");
    // ✅ Supprimer le brouillon
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    toast.info("Formulaire réinitialisé");
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shadow-lg">
              <span className="text-2xl">📝</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Nouvelle Attestation
              </h1>
              <p className="text-sm text-slate-500">
                Créez une attestation de formation, stage ou certification
              </p>
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
              <span className="text-sm font-medium text-slate-700">
                Progression du formulaire
              </span>
            </div>
            <Badge variant={completion === 100 ? "default" : "secondary"}>
              {completion}%
            </Badge>
          </div>
          <Progress value={completion} className="h-2" />
        </Card>

        {/* Raccourcis */}
        <Card className="mb-6 p-3 bg-white shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Keyboard className="w-4 h-4" />
            <span>Raccourcis :</span>
            <span className="font-mono bg-slate-100 px-2 py-1 rounded">
              Ctrl+S
            </span>
            <span>Sauvegarder le brouillon</span>
            <span className="font-mono bg-slate-100 px-2 py-1 rounded">
              Ctrl+R
            </span>
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
              <AlertDescription>
                ✅ Attestation créée avec succès !
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nom complet */}
            <div>
              <Label
                htmlFor="fullName"
                className={cn(fieldErrors.fullName && "text-red-500")}
              >
                👤 Nom complet *
              </Label>
              <Input
                id="fullName"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Ex: Koffi Amadou"
                className={cn(
                  "mt-1.5 h-11",
                  fieldErrors.fullName && "border-red-500 ring-red-500",
                )}
              />
              {fieldErrors.fullName && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.fullName}
                </p>
              )}
            </div>

            {/* Adresse e-mail */}
            <div>
              <Label
                htmlFor="email"
                className={cn(fieldErrors.email && "text-red-500")}
              >
                📧 Adresse e-mail (facultative)
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Ex: candidat@gmail.com"
                className={cn(
                  "mt-1.5 h-11",
                  fieldErrors.email && "border-red-500 ring-red-500",
                )}
              />
              {fieldErrors.email && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Sexe */}
            <div>
              <Label
                htmlFor="gender"
                className={cn(fieldErrors.gender && "text-red-500")}
              >
                ⚥ Sexe *
              </Label>
              <Select
                value={form.gender || ""}
                onValueChange={(v) => handleSelect("gender", v)}
              >
                <SelectTrigger
                  className={cn(
                    "mt-1.5 h-11",
                    fieldErrors.gender && "border-red-500 ring-red-500",
                  )}
                >
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.gender && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.gender}
                </p>
              )}
            </div>

            {/* Date de naissance */}
            <div>
              <Label
                htmlFor="birthDate"
                className={cn(fieldErrors.birthDate && "text-red-500")}
              >
                🎂 Date de naissance *
              </Label>
              <DateInput
                id="birthDate"
                name="birthDate"
                value={form.birthDate}
                onChange={handleChange}
                className={cn(
                  "mt-1.5",
                  fieldErrors.birthDate && "border-red-500",
                )}
              />
              {fieldErrors.birthDate && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.birthDate}
                </p>
              )}
            </div>

            {/* Lieu de naissance */}
            <div>
              <Label
                htmlFor="birthPlace"
                className={cn(fieldErrors.birthPlace && "text-red-500")}
              >
                📍 Lieu de naissance *
              </Label>
              <Input
                id="birthPlace"
                name="birthPlace"
                value={form.birthPlace}
                onChange={handleChange}
                placeholder="Ex: Cotonou, Bénin"
                className={cn(
                  "mt-1.5 h-11",
                  fieldErrors.birthPlace && "border-red-500 ring-red-500",
                )}
              />
              {fieldErrors.birthPlace && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.birthPlace}
                </p>
              )}
            </div>

            {/* Type d'attestation */}
            <div>
              <Label
                htmlFor="type"
                className={cn(fieldErrors.type && "text-red-500")}
              >
                📑 Type d&apos;attestation
              </Label>
              <Select
                value={form.type}
                onValueChange={(v) => handleSelect("type", v)}
              >
                <SelectTrigger
                  className={cn(
                    "mt-1.5 h-11",
                    fieldErrors.type && "border-red-500 ring-red-500",
                  )}
                >
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {ATTESTATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.type && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.type}
                </p>
              )}
            </div>

            {/* Formation */}
            <div>
              <Label
                htmlFor="formation"
                className={cn(fieldErrors.formation && "text-red-500")}
              >
                🎓 Formation *
              </Label>
              <Input
                id="formation"
                name="formation"
                value={form.formation}
                onChange={handleChange}
                placeholder="Nom de la formation"
                className={cn(
                  "mt-1.5 h-11",
                  fieldErrors.formation && "border-red-500 ring-red-500",
                )}
                list="formations-list"
              />
              <datalist id="formations-list">
                {formations.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {fieldErrors.formation && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.formation}
                </p>
              )}
            </div>

            {/* Dates */}
            <div>
              <Label
                htmlFor="startDate"
                className={cn(fieldErrors.startDate && "text-red-500")}
              >
                📅 Date de début *
              </Label>
              <DateInput
                id="startDate"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className={cn(
                  "mt-1.5",
                  fieldErrors.startDate && "border-red-500",
                )}
              />
              {fieldErrors.startDate && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.startDate}
                </p>
              )}
            </div>

            <div>
              <Label
                htmlFor="endDate"
                className={cn(fieldErrors.endDate && "text-red-500")}
              >
                📅 Date de fin *
              </Label>
              <DateInput
                id="endDate"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className={cn(
                  "mt-1.5",
                  fieldErrors.endDate && "border-red-500",
                )}
              />
              {fieldErrors.endDate && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.endDate}
                </p>
              )}
            </div>

            {/* Lieu */}
            <div>
              <Label
                htmlFor="location"
                className={cn(fieldErrors.location && "text-red-500")}
              >
                📍 Lieu *
              </Label>
              <Input
                id="location"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Lieu de la formation"
                className={cn(
                  "mt-1.5 h-11",
                  fieldErrors.location && "border-red-500 ring-red-500",
                )}
              />
              {fieldErrors.location && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.location}
                </p>
              )}
            </div>

            {/* Formateur */}
            <div>
              <Label
                htmlFor="instructor"
                className={cn(fieldErrors.instructor && "text-red-500")}
              >
                👨‍🏫 Formateur *
              </Label>
              <Input
                id="instructor"
                name="instructor"
                value={form.instructor}
                onChange={handleChange}
                placeholder="Nom du formateur"
                className={cn(
                  "mt-1.5 h-11",
                  fieldErrors.instructor && "border-red-500 ring-red-500",
                )}
              />
              {fieldErrors.instructor && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.instructor}
                </p>
              )}
            </div>

            {/* Société émettrice */}
            <div className="md:col-span-2">
              <Label
                htmlFor="issuingCompany"
                className={cn(fieldErrors.issuingCompany && "text-red-500")}
              >
                🏢 Société émettrice
              </Label>
              <Input
                id="issuingCompany"
                name="issuingCompany"
                value={form.issuingCompany}
                onChange={handleChange}
                className={cn(
                  "mt-1.5 h-11",
                  fieldErrors.issuingCompany && "border-red-500 ring-red-500",
                )}
              />
              {fieldErrors.issuingCompany && (
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                  → {fieldErrors.issuingCompany}
                </p>
              )}
            </div>

            {/* Champs spécifiques STAGE */}
            {form.type === "STAGE" && (
              <>
                <div className="md:col-span-2 mt-4 border-t pt-4">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">
                    📋 Informations de Stage
                  </h3>
                </div>
                <div>
                  <Label
                    htmlFor="stageHours"
                    className={cn(fieldErrors.stageHours && "text-red-500")}
                  >
                    ⏱️ Heures de stage
                  </Label>
                  <Input
                    id="stageHours"
                    name="stageHours"
                    type="number"
                    value={form.stageHours || ""}
                    onChange={(e) =>
                      handleNumberChange("stageHours", e.target.value)
                    }
                    placeholder="120"
                    className={cn(
                      "mt-1.5 h-11",
                      fieldErrors.stageHours && "border-red-500",
                    )}
                  />
                  {fieldErrors.stageHours && (
                    <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                      → {fieldErrors.stageHours}
                    </p>
                  )}
                </div>
                <div>
                  <Label
                    htmlFor="stageScore"
                    className={cn(fieldErrors.stageScore && "text-red-500")}
                  >
                    📊 Score du stage (0-100)
                  </Label>
                  <Input
                    id="stageScore"
                    name="stageScore"
                    type="number"
                    min="0"
                    max="100"
                    value={form.stageScore || ""}
                    onChange={(e) =>
                      handleNumberChange("stageScore", e.target.value)
                    }
                    placeholder="85"
                    className={cn(
                      "mt-1.5 h-11",
                      fieldErrors.stageScore && "border-red-500",
                    )}
                  />
                  {fieldErrors.stageScore && (
                    <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                      → {fieldErrors.stageScore}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="stageObservations">
                    💬 Observations du tuteur
                  </Label>
                  <textarea
                    id="stageObservations"
                    name="stageObservations"
                    value={form.stageObservations || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        stageObservations: e.target.value,
                      }))
                    }
                    placeholder="Décrivez le déroulement du stage..."
                    className="w-full min-h-[100px] px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand resize-none mt-1.5"
                    maxLength={1000}
                  />
                  <div className="text-right text-xs text-slate-500 mt-1">
                    {form.stageObservations?.length || 0}/1000
                  </div>
                </div>
              </>
            )}

            {/* Champs spécifiques CERTIFICATION */}
            {form.type === "CERTIFICATION" && (
              <>
                <div className="md:col-span-2 mt-4 border-t pt-4">
                  <h3 className="text-lg font-bold text-amber-600 mb-4">
                    🏆 Informations de Certification
                  </h3>
                </div>
                <div>
                  <Label
                    htmlFor="certificationHours"
                    className={cn(
                      fieldErrors.certificationHours && "text-red-500",
                    )}
                  >
                    ⏱️ Heures de formation
                  </Label>
                  <Input
                    id="certificationHours"
                    name="certificationHours"
                    type="number"
                    value={form.certificationHours || ""}
                    onChange={(e) =>
                      handleNumberChange("certificationHours", e.target.value)
                    }
                    placeholder="200"
                    className={cn(
                      "mt-1.5 h-11",
                      fieldErrors.certificationHours && "border-red-500",
                    )}
                  />
                  {fieldErrors.certificationHours && (
                    <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                      → {fieldErrors.certificationHours}
                    </p>
                  )}
                </div>
                <div>
                  <Label
                    htmlFor="certificationScore"
                    className={cn(
                      fieldErrors.certificationScore && "text-red-500",
                    )}
                  >
                    📊 Score (0-100)
                  </Label>
                  <Input
                    id="certificationScore"
                    name="certificationScore"
                    type="number"
                    min="0"
                    max="100"
                    value={form.certificationScore || ""}
                    onChange={(e) =>
                      handleNumberChange("certificationScore", e.target.value)
                    }
                    placeholder="90"
                    className={cn(
                      "mt-1.5 h-11",
                      fieldErrors.certificationScore && "border-red-500",
                    )}
                  />
                  {fieldErrors.certificationScore && (
                    <p className="text-[10px] text-red-500 mt-1 font-bold italic">
                      → {fieldErrors.certificationScore}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="certificationObservations">
                    💬 Observations du jury
                  </Label>
                  <textarea
                    id="certificationObservations"
                    name="certificationObservations"
                    value={form.certificationObservations || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        certificationObservations: e.target.value,
                      }))
                    }
                    placeholder="Évaluez la prestation du candidat..."
                    className="w-full min-h-[100px] px-4 py-3 rounded-md border border-amber-200 bg-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none mt-1.5"
                    maxLength={1000}
                  />
                  <div className="text-right text-xs text-amber-400 mt-1">
                    {form.certificationObservations?.length || 0}/1000
                  </div>
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
              className="gap-2 bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Création...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Créer l&apos;attestation
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
