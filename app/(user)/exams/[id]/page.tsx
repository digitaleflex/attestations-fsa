"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock, BookOpen, Save } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

import { ExamInstructions } from "./_components/ExamInstructions";
import { ExamPart1 } from "./_components/ExamPart1";
import { ExamPart2 } from "./_components/ExamPart2";
import { ExamPart3 } from "./_components/ExamPart3";
import type { ExamData, ExamPart } from "./_components/types";

interface ExamSessionResponse {
  id: string;
  duration: number;
}

export default function ExamSessionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [currentPart, setCurrentPart] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [showInstructions, setShowInstructions] = useState(true);
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => apiFetch(`/api/exams/${id}`) as Promise<ExamData>,
    staleTime: 5 * 60 * 1000,
  });

  const startMutation = useMutation<ExamSessionResponse, Error, void>({
    mutationFn: () => apiFetch<ExamSessionResponse>(`/api/exams/${id}/start`, { method: "POST" }),
    onSuccess: (data) => {
      setTimeRemaining(data.duration || 3600);
      startTimer();
    },
    onError: (error) => {
      toast.error(error.message || "Impossible de démarrer l'examen");
      router.push("/exams");
    },
  });

  const submitMutation = useMutation<void, Error, Record<string, string>>({
    mutationFn: (finalAnswers) =>
      apiFetch<void>(`/api/exams/${id}/submit?v=${Date.now()}`, {
        method: "POST",
        body: JSON.stringify({ answers: finalAnswers }),
      }),
    onSuccess: () => {
      toast.success("✅ Examen soumis avec succès !");
      localStorage.removeItem(`exam-${id}-draft`);
      router.push("/results");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la soumission. Vos réponses sont sauvegardées localement.");
      setIsSubmitting(false);
    },
  });

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) { handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Draft auto-save on answers/part change
  useEffect(() => {
    if (showInstructions || !id) return;
    localStorage.setItem(`exam-${id}-draft`, JSON.stringify({
      answers, timeRemaining, currentPart, lastSync: new Date().toISOString(),
    }));
  }, [answers, currentPart, id, showInstructions]);

  // Timer sync every 10s
  useEffect(() => {
    if (showInstructions) return;
    const interval = setInterval(() => {
      const raw = localStorage.getItem(`exam-${id}-draft`);
      const draft = raw ? JSON.parse(raw) : { answers: {} };
      localStorage.setItem(`exam-${id}-draft`, JSON.stringify({ ...draft, timeRemaining, currentPart }));
    }, 10000);
    return () => clearInterval(interval);
  }, [timeRemaining, currentPart, id, showInstructions]);

  // Restore draft on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(`exam-${id}-draft`);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      setAnswers(saved.answers || {});
      setTimeRemaining(saved.timeRemaining || 3600);
      setCurrentPart(saved.currentPart || 1);
      toast.info("📝 Brouillon récupéré automatiquement");
    } catch {
      localStorage.removeItem(`exam-${id}-draft`);
    }
  }, [id]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    submitMutation.mutate(answers);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (examLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500">Chargement de l'examen...</p>
        </div>
      </div>
    );
  }

  if (showInstructions && exam) {
    return (
      <ExamInstructions
        exam={exam}
        agreedToRules={agreedToRules}
        onAgreedChange={setAgreedToRules}
        onStart={() => { setShowInstructions(false); startMutation.mutate(); }}
      />
    );
  }

  const parts = exam?.parts || [];
  const part1Questions = parts.find((p: ExamPart) => p.type === "QCM" || p.order === 1)?.questions || [];
  const part2Questions = parts.find((p: ExamPart) => p.type === "OPEN" || p.order === 2)?.questions || [];
  const part3 = parts.find((p: ExamPart) => p.type === "CASE_STUDY");
  const part3Questions = part3?.questions || [];
  const part3Subject = part3?.scenario || exam?.part3Subject || "Sujet non disponible";
  const hasPart3 = exam?.part3Enabled ?? !!part3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sticky header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-800 text-sm sm:text-base truncate">{exam?.name}</h1>
              <p className="text-[10px] sm:text-xs text-slate-500">
                Partie {currentPart} sur {hasPart3 ? 3 : 2}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 pt-3 sm:pt-0">
            <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg ${
              timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
            }`}>
              <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${timeRemaining < 300 ? 'animate-pulse' : ''}`} />
              <span className="font-mono font-bold text-sm sm:text-lg">{formatTime(timeRemaining)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-2 text-xs sm:text-sm h-8 sm:h-10"
            >
              <Save className="w-3 h-3 sm:w-4 sm:h-4" />
              Soumettre
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
          <Progress value={((currentPart - 1) / (hasPart3 ? 2 : 1)) * 100} className="h-2" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {currentPart === 1 && (
          <ExamPart1
            questions={part1Questions}
            answers={answers}
            totalPoints={exam?.part1Points || 20}
            onAnswerChange={handleAnswerChange}
            onNextPart={() => setCurrentPart(2)}
          />
        )}

        {currentPart === 2 && (
          <ExamPart2
            questions={part2Questions}
            answers={answers}
            totalPoints={exam?.part2Points || 40}
            hasPart3={hasPart3}
            isSubmitting={isSubmitting}
            onAnswerChange={handleAnswerChange}
            onBack={() => setCurrentPart(1)}
            onNextPart={() => setCurrentPart(3)}
            onSubmit={handleSubmit}
          />
        )}

        {currentPart === 3 && hasPart3 && (
          <ExamPart3
            subject={part3Subject}
            questions={part3Questions}
            answers={answers}
            totalPoints={exam?.part3Points || 40}
            isSubmitting={isSubmitting}
            onAnswerChange={(value) => setAnswers((prev) => ({ ...prev, part3: value }))}
            onBack={() => setCurrentPart(2)}
            onSubmit={handleSubmit}
          />
        )}
      </main>
    </div>
  );
}
