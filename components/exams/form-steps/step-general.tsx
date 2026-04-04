"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExamFormData } from "../types";
import { useEffect, useState } from "react";
import { Calendar, Clock, FileText, BookOpen, Info } from "lucide-react";

type Props = {
  formData: ExamFormData;
  updateFormData: (updates: Partial<ExamFormData>) => void;
};

export function StepGeneral({ formData, updateFormData }: Props) {
  const [formations, setFormations] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    fetch("/api/formations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFormations(
            data.map((f: any) => ({ id: f.id || f.name, name: f.name })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleStatusChange = (value: string) => {
    updateFormData({ status: value as "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED" });
  };

  // Convert datetime-local format to display-friendly format
  const formatScheduledDate = (isoDate: string) => {
    if (!isoDate) return "";
    try {
      const date = new Date(isoDate);
      return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-primary pl-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">
          Informations Générales
        </h2>
        <p className="text-slate-500 text-sm">
          Définissez le titre, la date de programmation et le statut de publication.
        </p>
      </div>
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-semibold">
            <FileText className="w-4 h-4 inline mr-2" />
            Titre de l'Examen *
          </Label>
          <Input
            id="title"
            placeholder="Ex: Examen Final - Gestion de Projet"
            value={formData.title}
            onChange={(e) => updateFormData({ title: e.target.value })}
            className="h-12 text-lg focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="formationId" className="text-sm font-semibold">
            <BookOpen className="w-4 h-4 inline mr-2" />
            Formation *
          </Label>
          <select
            id="formationId"
            className="w-full h-11 px-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white"
            value={formData.formationId || ""}
            onChange={(e: any) =>
              updateFormData({ formationId: e.target.value })
            }
          >
            <option value="">Sélectionner une formation</option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold">
            Description (optionnel)
          </Label>
          <Textarea
            id="description"
            placeholder="Instructions pour les candidats..."
            value={formData.description || ""}
            onChange={(e) => updateFormData({ description: e.target.value })}
            className="min-h-[100px] resize-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* ✅ SCHEDULING: Date and Time Picker */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-blue-800">📅 Programmation de l'Examen</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledAt" className="text-sm font-semibold text-blue-900">
                Date et Heure de l'Examen
              </Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt || ""}
                onChange={(e) => updateFormData({ scheduledAt: e.target.value })}
                className="h-12 focus:ring-2 focus:ring-blue-500/20"
                min={new Date().toISOString().slice(0, 16)}
              />
              {formData.scheduledAt && (
                <p className="text-xs text-blue-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Prévu le: {formatScheduledDate(formData.scheduledAt)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-semibold text-blue-900">
                Statut de l'Examen
              </Label>
              <select
                id="status"
                className="w-full h-11 px-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                value={formData.status}
                onChange={(e: any) => handleStatusChange(e.target.value)}
              >
                <option value="DRAFT">📝 Brouillon</option>
                <option value="SCHEDULED">📅 Programmé</option>
                <option value="PUBLISHED">✅ Publié (Disponible)</option>
                <option value="ARCHIVED">📦 Archivé</option>
              </select>
            </div>
          </div>

          {formData.status === "SCHEDULED" && !formData.scheduledAt && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                <strong>Attention:</strong> Vous devez sélectionner une date et une heure pour programmer cet examen.
              </p>
            </div>
          )}

          {formData.status === "SCHEDULED" && formData.scheduledAt && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
              <Calendar className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-emerald-800">
                <p className="font-semibold">Examen programmé avec succès</p>
                <p>Les candidats verront un compte à rebours jusqu'à cette date.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
