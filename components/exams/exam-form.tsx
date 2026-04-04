"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Layout,
  ListTodo,
  MessageSquare,
  BookOpen,
  Save,
  ShieldCheck,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ExamFormData, DEFAULT_PARTS, Part } from "./types";
import { StepGeneral } from "./form-steps/step-general";
import { StepPartBuilder } from "./form-steps/step-part-builder";
import { StepSummary } from "./form-steps/step-summary";

export function ExamForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExamFormData>(
    initialData || {
      title: "",
      description: "",
      status: "DRAFT",
      scheduledAt: "",
      session: "",
      duration: 3600,
      passingScore: 60,
      randomizeQuestions: false,
      showResults: false,
      parts: DEFAULT_PARTS,
    },
  );

  const steps = [
    { label: "Informations", icon: Layout },
    { label: "Partie 1: QCM", icon: ListTodo },
    { label: "Partie 2: Ouverte", icon: MessageSquare },
    { label: "Partie 3: Cas", icon: BookOpen },
    { label: "Récapitulatif", icon: Save },
  ];

  // 🔄 AUTO-SAVE LOGIC
  const STORAGE_KEY = "fsa_exam_draft";

  // Load draft on mount (only for new exams)
  React.useEffect(() => {
    if (!initialData) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData(parsed);
          toast.info("Brouillon d'examen restauré automatiquement", {
            action: {
              label: "Effacer",
              onClick: () => {
                localStorage.removeItem(STORAGE_KEY);
                window.location.reload();
              }
            }
          });
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      }
    }
  }, [initialData]);

  // Save to localStorage whenever formData changes
  React.useEffect(() => {
    if (!initialData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      setLastSaved(new Date().toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [formData, initialData]);

  const handleNext = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 0));

  const updateFormData = (updates: Partial<ExamFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const updatePart = (index: number, updates: Partial<Part>) => {
    const newParts = [...formData.parts];
    newParts[index] = { ...newParts[index], ...updates };
    setFormData({ ...formData, parts: newParts });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Use admin API endpoint
      const url = initialData
        ? `/api/admin/exams/${initialData.id}`
        : "/api/admin/exams";
      const method = initialData ? "PATCH" : "POST";

      // Build the parts array from formData
      const partsData = formData.parts
        .filter((p) => p.enabled)
        .map((p, i) => ({
          title: p.title,
          type: p.type,
          duration: p.duration,
          points: p.points,
          order: i + 1,
          enabled: p.enabled,
          scenario: p.scenario || "",
          mode: p.mode || "digital",
          questions: p.questions.map((q, qIdx) => ({
            text: q.text,
            type: q.type,
            points: q.points,
            order: qIdx + 1,
            options: q.options?.map((o) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              feedback: o.feedback || "",
            })),
          })),
        }));

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.title,
          title: formData.title,
          description: formData.description,
          status: formData.status,
          scheduledAt: formData.scheduledAt,
          formationId: formData.formationId,
          session: formData.session,
          duration: formData.duration,
          passingScore: formData.passingScore,
          randomizeQuestions: formData.randomizeQuestions,
          showResults: formData.showResults,
          parts: partsData,
        }),
      });

      if (!res.ok) throw new Error("Erreur lors de l'enregistrement");

      // Clear draft on success
      localStorage.removeItem(STORAGE_KEY);

      toast.success(initialData ? "Examen modifié !" : "Examen créé !");
      router.push("/admin/exams");
    } catch (err: any) {
      toast.error(err.message || "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center justify-between px-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === i;
          const isDone = step > i;
          return (
            <React.Fragment key={s.label}>
              <div
                className="flex flex-col items-center gap-2 group cursor-pointer"
                onClick={() => setStep(i)}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isActive
                      ? "border-primary bg-primary text-white scale-110 shadow-lg"
                      : isDone
                        ? "border-emerald-500 bg-emerald-50 text-emerald-500"
                        : "border-slate-200 text-slate-400"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider font-bold ${
                    isActive
                      ? "text-primary"
                      : isDone
                        ? "text-emerald-500"
                        : "text-slate-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-[2px] mx-4 transition-colors duration-300 ${step > i ? "bg-emerald-500" : "bg-slate-200"}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      
      {/* 🛡️ AUTO-SAVE INDICATOR */}
      {!initialData && (
        <div className="flex justify-center -mb-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full shadow-sm animate-in fade-in zoom-in duration-500">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Sauvegarde auto active {lastSaved && `• ${lastSaved}`}
            </span>
          </div>
        </div>
      )}

      <Card className="p-8 shadow-xl border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {step === 0 && (
          <StepGeneral formData={formData} updateFormData={updateFormData} />
        )}

        {step >= 1 && step <= 3 && (
          <StepPartBuilder
            part={formData.parts[step - 1]}
            onUpdatePart={(updates) => updatePart(step - 1, updates)}
          />
        )}

        {step === 4 && (
          <StepSummary
            formData={formData}
            saving={saving}
            onSave={handleSubmit}
          />
        )}

        {/* Navigation Buttons */}
        {step < 4 && (
          <div className="flex items-center justify-between pt-8 border-t mt-8 bg-white sticky bottom-0">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={step === 0}
              className="h-11 px-6 gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Précédent
            </Button>
            <Button
              onClick={handleNext}
              className="h-11 px-8 gap-2 bg-slate-800 hover:bg-slate-900"
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
