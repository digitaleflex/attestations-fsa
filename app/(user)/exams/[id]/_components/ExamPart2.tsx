"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { PenTool, Eye, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

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
          <div key={question.id} className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm font-semibold text-slate-700 mb-3">Question {idx + 1}</p>
            <p className="text-base text-slate-800 mb-4">{question.text}</p>
            <Textarea
              value={answers[question.id] || ""}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder="Rédigez votre réponse ici..."
              rows={5}
              className="resize-none"
              style={{ fontSize: "16px" }}
            />
            <p className="text-xs text-slate-400 mt-2 text-right">
              {(answers[question.id] || "").length} caractères
            </p>
          </div>
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
            <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
              <AlertDialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 shadow-lg shadow-emerald-200 text-sm h-10">
                  <CheckCircle className="w-4 h-4" />
                  Terminer l'examen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-emerald-600 font-bold text-xl">
                    <CheckCircle className="w-6 h-6" />
                    Soumettre l'examen ?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
                    Vous êtes sur le point de finaliser votre session.
                    Assurez-vous d'avoir répondu à toutes les questions avant de confirmer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6 gap-3">
                  <AlertDialogCancel className="border-slate-200 text-slate-600 hover:bg-slate-50">
                    Continuer l'examen
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); onSubmit(); }}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
                  >
                    Oui, soumettre maintenant
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </Card>
  );
}
