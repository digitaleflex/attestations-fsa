"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { PenTool, Eye, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { Question } from "./types";

interface ExamPart2Props {
  questions: Question[];
  answers: Record<string, string>;
  totalPoints: number;
  hasPart3: boolean;
  isSubmitting: boolean;
  onAnswerChange: (questionId: string, value: string) => void;
  onBack: () => void;
  onNextPart: () => void;
  onSubmit: () => void;
}

export function ExamPart2({
  questions,
  answers,
  totalPoints,
  hasPart3,
  isSubmitting,
  onAnswerChange,
  onBack,
  onNextPart,
  onSubmit,
}: ExamPart2Props) {
  return (
    <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <PenTool className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Partie 2 - Questions ouvertes</h2>
          <p className="text-sm text-slate-500">{questions.length} questions • {totalPoints} points</p>
        </div>
      </div>

      <Alert className="bg-purple-50 border-purple-200 mb-6">
        <Eye className="w-4 h-4 text-purple-600" />
        <AlertTitle className="text-purple-800">Visibilité Admin</AlertTitle>
        <AlertDescription className="text-purple-700 text-sm">
          Les administrateurs verront vos réponses lors de la correction. Soyez clair et précis.
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {questions.map((question: Question, idx: number) => (
          <fieldset key={question.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <legend className="text-sm font-semibold text-slate-700 mb-3">Question {idx + 1}</legend>
            <p className="text-base text-slate-800 mb-4">{question.text}</p>
            <label htmlFor={`answer-${question.id}`} className="sr-only">Votre réponse à la question {idx + 1}</label>
            <Textarea
              id={`answer-${question.id}`}
              aria-describedby={`answer-help-${question.id}`}
              value={answers[question.id] || ""}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder="Rédigez votre réponse ici..."
              rows={5}
              className="resize-none"
              style={{ fontSize: "16px" }}
            />
            <p id={`answer-help-${question.id}`} className="text-xs text-slate-400 mt-2 text-right">
              {(answers[question.id] || "").length} caractères
            </p>
          </fieldset>
        ))}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onBack} className="gap-2 text-sm h-10">
            <ChevronLeft className="w-4 h-4" />
            Retour Partie 1
          </Button>

          {hasPart3 ? (
            <Button
              onClick={onNextPart}
              className="gap-2 bg-gradient-to-r from-purple-600 to-amber-600 text-sm h-10"
            >
              Partie 3 - Étude de cas
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 shadow-lg shadow-emerald-200 text-sm h-10"
            >
              <CheckCircle className="w-4 h-4" />
              {isSubmitting ? "Soumission…" : "Terminer l'examen"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
