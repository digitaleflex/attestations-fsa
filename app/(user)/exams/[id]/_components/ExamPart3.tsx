"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, FileText, Eye, Save, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { Question } from "./types";

interface ExamPart3Props {
  subject: string;
  questions: Question[];
  answers: Record<string, string>;
  totalPoints: number;
  isSubmitting: boolean;
  onAnswerChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function ExamPart3({
  subject,
  questions,
  answers,
  totalPoints,
  isSubmitting,
  onAnswerChange,
  onBack,
  onSubmit,
}: ExamPart3Props) {
  const [showSubject, setShowSubject] = useState(false);

  return (
    <Card className="p-3 sm:p-6 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">Partie 3 — Étude de cas</h2>
          <p className="text-xs sm:text-sm text-slate-500">{totalPoints} pts • Composition numérique</p>
        </div>
      </div>

      {!showSubject ? (
        <div className="text-center py-10 sm:py-16 px-2">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
            <Eye className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">Prêt à découvrir le sujet ?</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
            Une fois le sujet affiché, vous rédigerez votre réponse directement dans la zone de texte.
            La sauvegarde est automatique.
          </p>
          <Button
            onClick={() => setShowSubject(true)}
            size="lg"
            className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 w-full sm:w-auto h-12 sm:h-11 text-base sm:text-sm"
          >
            <Eye className="w-5 h-5" />
            Découvrir le sujet
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sujet collapsible — natif HTML, fonctionne sur tous les mobiles */}
          <details open className="group rounded-xl border border-slate-200 overflow-hidden">
            <summary className="cursor-pointer flex items-center justify-between p-3 sm:p-4 bg-slate-50 select-none list-none">
              <span className="flex items-center gap-2 font-bold text-slate-700 text-xs uppercase tracking-wider">
                <BookOpen className="w-4 h-4 text-amber-600" />
                Énoncé du sujet
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" />
            </summary>
            <div className="p-3 sm:p-4 bg-white border-t border-slate-100 space-y-3">
              <p className="text-sm sm:text-base text-slate-700 whitespace-pre-wrap leading-relaxed">
                {subject}
              </p>
              {questions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Questions
                  </p>
                  {questions.map((q, idx) => (
                    <div key={q.id} className="p-3 bg-blue-50 rounded-lg">
                      <p className="font-bold text-blue-900 text-xs mb-1">Q{idx + 1}</p>
                      <p className="text-slate-700 text-sm">{q.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          {/* Zone de rédaction */}
          <div className="space-y-2">
            <Label htmlFor="part3" className="text-sm font-semibold text-slate-700">
              Votre réponse :
            </Label>
            <Textarea
              id="part3"
              value={answers.part3 || ""}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="Rédigez votre composition ici. Structurez votre réponse en paragraphes..."
              className="resize-y leading-relaxed p-3 sm:p-4 min-h-[55dvh] sm:min-h-[50vh]"
              style={{ fontSize: "16px" }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Save className="w-3 h-3" /> Sauvegarde auto
              </span>
              <span className="text-xs text-slate-400">
                {(answers.part3 || "").length} caractères
              </span>
            </div>
          </div>

          {/* Barre d'actions — sticky en bas sur mobile */}
          <div className="sticky bottom-0 z-10 bg-white border-t border-slate-100 pt-3 pb-4 sm:pb-3 -mx-3 px-3 sm:-mx-6 sm:px-6 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={onBack}
              className="gap-2 h-11 sm:h-10 text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour
            </Button>
            <Button
              onClick={onSubmit}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 h-12 sm:h-10 text-base sm:text-sm flex-1 sm:flex-none"
              disabled={isSubmitting || !answers.part3?.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Soumission...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Terminer et soumettre
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
