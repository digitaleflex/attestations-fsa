"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExamFormData } from "../types";
import { useEffect, useState } from "react";

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
    updateFormData({ status: value as "DRAFT" | "PUBLISHED" | "ARCHIVED" });
  };

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-primary pl-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">
          Informations Générales
        </h2>
        <p className="text-slate-500 text-sm">
          Définissez le titre et le statut de publication.
        </p>
      </div>
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-semibold">
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
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-semibold">
              Statut
            </Label>
            <select
              id="status"
              className="w-full h-11 px-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none"
              value={formData.status}
              onChange={(e: any) => handleStatusChange(e.target.value)}
            >
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
