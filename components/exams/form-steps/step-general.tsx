"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "lucide-react";
import { ExamFormData } from "../types";

type Props = {
  formData: ExamFormData;
  updateFormData: (updates: Partial<ExamFormData>) => void;
};

export function StepGeneral({ formData, updateFormData }: Props) {
  return (
    <div className="space-y-6">
      <div className="border-l-4 border-primary pl-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Informations Générales</h2>
        <p className="text-slate-500 text-sm">Définissez le titre et le statut de publication.</p>
      </div>
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-semibold">Titre de l'Examen</Label>
          <Input
            id="title"
            placeholder="Ex: Examen Final - Gestion de Projet"
            value={formData.title}
            onChange={(e) => updateFormData({ title: e.target.value })}
            className="h-12 text-lg focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold">Description (optionnel)</Label>
          <Textarea
            id="description"
            placeholder="Instructions pour les candidats..."
            value={formData.description}
            onChange={(e) => updateFormData({ description: e.target.value })}
            className="min-h-[100px] resize-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-semibold">Statut Initial</Label>
            <select
              id="status"
              className="w-full h-11 px-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none"
              value={formData.status}
              onChange={(e: any) => updateFormData({ status: e.target.value })}
            >
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié immédiatement</option>
              <option value="SCHEDULED">Programmé</option>
            </select>
          </div>
          {formData.status === 'SCHEDULED' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
              <Label htmlFor="scheduledAt" className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date de Publication
              </Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => updateFormData({ scheduledAt: e.target.value })}
                className="h-11 border-blue-200 focus:border-blue-400 focus:ring-blue-50"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
