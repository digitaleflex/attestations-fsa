"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Save, CheckCircle, AlertCircle } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api-client";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ATTESTATION_TYPES = [
  { value: "FORMATION", label: "Formation" },
  { value: "STAGE", label: "Stage" },
  { value: "CERTIFICATION", label: "Certification" },
];

const GENDER_OPTIONS = [
  { value: "M", label: "Masculin" },
  { value: "F", label: "Féminin" },
];

export default function EditAttestationPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formations, setFormations] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<any>({});

  const { data: attData, isLoading: attLoading } = useQuery({
    queryKey: ["attestation", id],
    queryFn: () => apiFetch(`/api/attestations/${id}`),
    staleTime: 5 * 60 * 1000,
  });

  const { data: formationsData } = useQuery({
    queryKey: ["formations", "all"],
    queryFn: () => apiFetch("/api/formations"),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (attData) {
      setForm({
        fullName: attData.fullName || "",
        gender: attData.gender || "",
        birthDate: attData.birthDate?.slice(0, 10) || "",
        birthPlace: attData.birthPlace || "",
        formation: attData.formation?.name || "",
        startDate: attData.startDate?.slice(0, 10) || "",
        endDate: attData.endDate?.slice(0, 10) || "",
        location: attData.location || "",
        instructor: attData.instructor || "",
        issuingCompany: attData.issuingCompany || "",
        type: attData.type || "FORMATION",
        stageHours: attData.stageHours || "",
        stageScore: attData.stageScore || "",
        stageObservations: attData.stageObservations || "",
        certificationMention: attData.certificationMention || "",
        certificationScore: attData.certificationScore || "",
        certificationHours: attData.certificationHours || "",
        certificationObservations: attData.certificationObservations || "",
      });
    }
    if (formationsData) {
      setFormations(Array.isArray(formationsData) ? formationsData.map((f: any) => f.name) : []);
    }
  }, [attData, formationsData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev: any) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev: any) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSelect = (name: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev: any) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleNumberChange = (name: string, value: string) => {
    const numValue = value ? parseInt(value) : undefined;
    setForm((prev: any) => ({ ...prev, [name]: numValue }));
  };

  const validate = (data: any) => {
    const errors: any = {};
    if (!data.fullName) errors.fullName = "Le nom est requis";
    if (!data.birthDate) errors.birthDate = "La date de naissance est requise";
    if (!data.birthPlace) errors.birthPlace = "Le lieu de naissance est requis";
    if (!data.formation) errors.formation = "La formation est requise";
    if (!data.startDate) errors.startDate = "La date de début est requise";
    if (!data.endDate) errors.endDate = "La date de fin est requise";
    if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
      errors.endDate = "La date de fin doit être postérieure";
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Veuillez corriger les erreurs");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      // Nettoyage des données pour éviter les erreurs Zod (ex: chaîne vide pour un enum optional)
      const submitData = { ...form };
      
      // Nettoyer les enums optionnels s'ils sont vides
      if (!submitData.gender) delete submitData.gender;
      if (!submitData.certificationMention) delete submitData.certificationMention;
      
      // Nettoyer les champs texte optionnels vides
      const optionalTextFields = [
          'stageObservations', 'certificationObservations', 
          'issuingCompany', 'location', 'instructor', 'formation'
      ];
      optionalTextFields.forEach(field => {
          if (submitData[field] === "") delete submitData[field];
      });

      // S'assurer que les nombres sont bien des nombres ou undefined
      if (submitData.stageHours === "") delete submitData.stageHours;
      if (submitData.stageScore === "") delete submitData.stageScore;
      if (submitData.certificationHours === "") delete submitData.certificationHours;
      if (submitData.certificationScore === "") delete submitData.certificationScore;

      await apiFetch(`/api/attestations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(submitData),
      });

      setSuccess(true);
      toast.success("✅ Attestation modifiée avec succès !");
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
      
      // Si on a des détails d'erreur (ex: Zod), on les affiche par champ
      if (err instanceof ApiError && err.details && Array.isArray(err.details)) {
        const errors: any = {};
        err.details.forEach((detail: any) => {
          if (detail.path && detail.path.length > 0) {
            const fieldName = detail.path[0];
            errors[fieldName] = detail.message;
          }
        });
        setFieldErrors(errors);
      }
    } finally {
      setSaving(false);
    }
  };

  if (attLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/admin/attestations/${id}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">✏️ Modifier l'attestation</h1>
              <p className="text-sm text-slate-500">{form?.code}</p>
            </div>
          </div>
        </div>

        {/* Alertes */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <AlertTitle className="text-emerald-800">Succès</AlertTitle>
            <AlertDescription className="text-emerald-700">
              Attestation modifiée avec succès !
            </AlertDescription>
          </Alert>
        )}

        {/* Formulaire - Rendu seulement si form est prêt */}
        {!form ? (
          <Card className="p-12 flex flex-col items-center justify-center bg-white shadow-lg space-y-4">
             <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
             <p className="text-slate-500 text-sm italic font-medium">Récuperation de la configuration...</p>
          </Card>
        ) : (
          <Card className="p-8 bg-white shadow-lg overflow-hidden border-none ring-1 ring-slate-200">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informations personnelles */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm">1</span>
                Informations personnelles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="fullName" className="text-sm font-semibold text-slate-700">👤 Nom complet *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={form?.fullName || ""}
                    onChange={handleChange}
                    className={cn("mt-1.5 h-11", fieldErrors.fullName && "border-red-500")}
                  />
                  {fieldErrors.fullName && <p className="text-xs text-red-500 mt-1">{fieldErrors.fullName}</p>}
                </div>

                <div>
                  <Label htmlFor="gender" className="text-sm font-semibold text-slate-700">⚥ Sexe</Label>
                  <Select value={form?.gender || ""} onValueChange={(v) => handleSelect("gender", v)}>
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

                <div>
                  <Label htmlFor="birthDate" className="text-sm font-semibold text-slate-700">🎂 Date de naissance *</Label>
                  <DateInput
                    id="birthDate"
                    name="birthDate"
                    value={form?.birthDate || ""}
                    onChange={handleChange}
                    className={cn("mt-1.5", fieldErrors.birthDate && "border-red-500")}
                  />
                  {fieldErrors.birthDate && <p className="text-xs text-red-500 mt-1">{fieldErrors.birthDate}</p>}
                </div>

                <div>
                  <Label htmlFor="birthPlace" className="text-sm font-semibold text-slate-700">📍 Lieu de naissance *</Label>
                  <Input
                    id="birthPlace"
                    name="birthPlace"
                    value={form?.birthPlace || ""}
                    onChange={handleChange}
                    placeholder="Ville, Pays"
                    className={cn("mt-1.5 h-11", fieldErrors.birthPlace && "border-red-500")}
                  />
                  {fieldErrors.birthPlace && <p className="text-xs text-red-500 mt-1">{fieldErrors.birthPlace}</p>}
                </div>
              </div>
            </div>

            {/* Détails de la formation */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-sm">2</span>
                Détails de la formation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="type" className="text-sm font-semibold text-slate-700">📑 Type d'attestation</Label>
                  <Select value={form?.type || ""} onValueChange={(v) => handleSelect("type", v)}>
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

                <div>
                  <Label htmlFor="formation" className="text-sm font-semibold text-slate-700">🎓 Formation *</Label>
                  <Input
                    id="formation"
                    name="formation"
                    value={form?.formation || ""}
                    onChange={handleChange}
                    className={cn("mt-1.5 h-11", fieldErrors.formation && "border-red-500")}
                    list="formations-list"
                  />
                  <datalist id="formations-list">
                    {formations.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {fieldErrors.formation && <p className="text-xs text-red-500 mt-1">{fieldErrors.formation}</p>}
                </div>

                <div>
                  <Label htmlFor="startDate" className="text-sm font-semibold text-slate-700">📅 Date de début *</Label>
                  <DateInput
                    id="startDate"
                    name="startDate"
                    value={form?.startDate || ""}
                    onChange={handleChange}
                    className={cn("mt-1.5", fieldErrors.startDate && "border-red-500")}
                  />
                  {fieldErrors.startDate && <p className="text-xs text-red-500 mt-1">{fieldErrors.startDate}</p>}
                </div>

                <div>
                  <Label htmlFor="endDate" className="text-sm font-semibold text-slate-700">📅 Date de fin *</Label>
                  <DateInput
                    id="endDate"
                    name="endDate"
                    value={form?.endDate || ""}
                    onChange={handleChange}
                    className={cn("mt-1.5", fieldErrors.endDate && "border-red-500")}
                  />
                  {fieldErrors.endDate && <p className="text-xs text-red-500 mt-1">{fieldErrors.endDate}</p>}
                </div>

                <div>
                  <Label htmlFor="location" className="text-sm font-semibold text-slate-700">📍 Lieu *</Label>
                  <Input
                    id="location"
                    name="location"
                    value={form?.location || ""}
                    onChange={handleChange}
                    className={cn("mt-1.5 h-11", fieldErrors.location && "border-red-500")}
                  />
                </div>

                <div>
                  <Label htmlFor="instructor" className="text-sm font-semibold text-slate-700">👨‍🏫 Formateur *</Label>
                  <Input
                    id="instructor"
                    name="instructor"
                    value={form?.instructor || ""}
                    onChange={handleChange}
                    className={cn("mt-1.5 h-11", fieldErrors.instructor && "border-red-500")}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="issuingCompany" className="text-sm font-semibold text-slate-700">🏢 Société émettrice</Label>
                  <Input
                    id="issuingCompany"
                    name="issuingCompany"
                    value={form?.issuingCompany || ""}
                    onChange={handleChange}
                    className="mt-1.5 h-11"
                  />
                </div>
              </div>
            </div>

            {/* Champs spécifiques */}
            {form?.type === "STAGE" && (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white text-sm">3</span>
                  Informations de Stage
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="stageHours" className="text-sm font-semibold text-slate-700">⏱️ Heures de stage</Label>
                    <Input
                      id="stageHours"
                      name="stageHours"
                      type="number"
                      value={form?.stageHours || ""}
                      onChange={(e) => handleNumberChange("stageHours", e.target.value)}
                      className="mt-1.5 h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="stageScore" className="text-sm font-semibold text-slate-700">📊 Score (0-100)</Label>
                    <Input
                      id="stageScore"
                      name="stageScore"
                      type="number"
                      min="0"
                      max="100"
                      value={form?.stageScore || ""}
                      onChange={(e) => handleNumberChange("stageScore", e.target.value)}
                      className="mt-1.5 h-11"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="stageObservations" className="text-sm font-semibold text-slate-700">📝 Observations du stage</Label>
                    <Input
                      id="stageObservations"
                      name="stageObservations"
                      value={form?.stageObservations || ""}
                      onChange={handleChange}
                      placeholder="Commentaires sur les performances..."
                      className="mt-1.5 h-11"
                    />
                  </div>
                </div>
              </div>
            )}

            {form?.type === "CERTIFICATION" && (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-sm">3</span>
                  Informations de Certification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="certificationHours" className="text-sm font-semibold text-slate-700">⏱️ Heures de formation</Label>
                    <Input
                      id="certificationHours"
                      name="certificationHours"
                      type="number"
                      value={form?.certificationHours || ""}
                      onChange={(e) => handleNumberChange("certificationHours", e.target.value)}
                      className="mt-1.5 h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="certificationScore" className="text-sm font-semibold text-slate-700">📊 Score (0-100)</Label>
                    <Input
                      id="certificationScore"
                      name="certificationScore"
                      type="number"
                      min="0"
                      max="100"
                      value={form?.certificationScore || ""}
                      onChange={(e) => handleNumberChange("certificationScore", e.target.value)}
                      className="mt-1.5 h-11"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="certificationObservations" className="text-sm font-semibold text-slate-700">📝 Observations de certification</Label>
                    <Input
                      id="certificationObservations"
                      name="certificationObservations"
                      value={form?.certificationObservations || ""}
                      onChange={handleChange}
                      placeholder="Commentaires sur le parcours..."
                      className="mt-1.5 h-11"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-6 border-t">
              <Link href={`/admin/attestations/${id}`}>
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Enregistrer les modifications
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
        )}
      </div>
    </div>
  );
}
