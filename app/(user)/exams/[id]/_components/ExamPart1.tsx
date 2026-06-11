"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import type { Question, QuestionOption } from "./types";

interface ExamPart1Props {
  questions: Question[];
  answers: Record<string, string>;
  totalPoints: number;
  onAnswerChange: (questionId: string, value: string) => void;
  onNextPart: () => void;
}

export function ExamPart1({ questions, answers, totalPoints, onAnswerChange, onNextPart }: ExamPart1Props) {
  const [currentQuestion, setCurrentQuestion] = useState(0);

  return (
    <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Partie 1 - QCM</h2>
          <p className="text-sm text-slate-500">{questions.length} questions • {totalPoints} points</p>
        </div>
      </div>

      {questions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              Question {currentQuestion + 1} sur {questions.length}
            </p>
            <Badge variant="outline">
              {Math.round((currentQuestion / questions.length) * 100)}% complété
            </Badge>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-base font-medium text-slate-800 mb-4">
              {questions[currentQuestion]?.text}
            </p>

            <RadioGroup
              value={answers[questions[currentQuestion]?.id] || ""}
              onValueChange={(value) => onAnswerChange(questions[currentQuestion]?.id, value)}
              className="space-y-3"
            >
              {questions[currentQuestion]?.options?.map((option: QuestionOption, idx: number) => (
                <div
                  key={option.id}
                  className="flex items-center space-x-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onAnswerChange(questions[currentQuestion]?.id, option.id)}
                >
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id} className="flex-1 cursor-pointer text-sm text-slate-700">
                    <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {option.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestion === 0}
              className="gap-2 text-sm h-10"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </Button>

            {currentQuestion < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentQuestion((prev) => prev + 1)}
                className="gap-2 text-sm h-10"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={onNextPart}
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-sm h-10"
              >
                Partie 2
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
