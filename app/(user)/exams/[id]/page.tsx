"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, BookOpen, Save, WifiOff, RefreshCw } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { ExamInstructions } from "./_components/ExamInstructions";
import { ExamPart1 } from "./_components/ExamPart1";
import { ExamPart2 } from "./_components/ExamPart2";
import { ExamPart3 } from "./_components/ExamPart3";
import type { ExamData, ExamPart } from "./_components/types";

type SaveState = "idle" | "saving" | "saved" | "offline" | "error";
interface ExamSessionResponse {
  id: string;
  duration: number;
}
interface DraftResponse {
  draft: {
    answers: Record<string, string>;
    timeRemaining: number;
    currentPart: number;
    lastSync: string;
  } | null;
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
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => apiFetch(`/api/exams/${id}`) as Promise<ExamData>,
    staleTime: 5 * 60 * 1000,
  });
  const draftQuery = useQuery<DraftResponse>({
    queryKey: ["exam-draft", id],
    queryFn: () => apiFetch<DraftResponse>(`/api/exams/${id}/draft`),
    staleTime: 0,
    retry: false,
    enabled: !showInstructions && !!id,
  });

  const answersRef = useRef(answers);
  const timeRef = useRef(timeRemaining);
  const partRef = useRef(currentPart);
  answersRef.current = answers;
  timeRef.current = timeRemaining;
  partRef.current = currentPart;

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    const threshold = [300, 60].find((value) => timeRemaining === value);
    if (threshold) {
      setAnnouncement(
        `Il reste ${threshold / 60} minute${threshold > 60 ? "s" : ""} à votre examen.`,
      );
    }
    if (timeRemaining === 0) {
      setAnnouncement("Le temps est écoulé. Votre examen va être soumis.");
    }
  }, [timeRemaining]);

  const startMutation = useMutation<ExamSessionResponse, Error, void>({
    mutationFn: () =>
      apiFetch<ExamSessionResponse>(`/api/exams/${id}/start`, { method: "POST" }),
    onSuccess: (data) => {
      setTimeRemaining(data.duration || 3600);
      startTimer();
    },
    onError: (error) => {
      toast.error(error.message || "Impossible de démarrer l'examen");
      router.push("/exams");
    },
  });

  const deleteDraftMutation = useMutation<void, Error, void>({
    mutationFn: () =>
      apiFetch<void>(`/api/exams/${id}/draft?v=${Date.now()}`, { method: "DELETE" }),
  });

  const submitMutation = useMutation<void, Error, Record<string, string>>({
    mutationFn: (finalAnswers) =>
      apiFetch<void>(`/api/exams/${id}/submit?v=${Date.now()}`, {
        method: "POST",
        body: JSON.stringify({ answers: finalAnswers }),
      }),
    onSuccess: () => {
      toast.success("Examen soumis avec succès !");
      localStorage.removeItem(`exam-${id}-draft`);
      deleteDraftMutation.mutate();
      if (timerRef.current) clearInterval(timerRef.current);
      router.push("/results");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la soumission. Vos réponses sont conservées.");
      setIsSubmitting(false);
      setShowSubmitDialog(false);
    },
  });

  useEffect(() => {
    if (!examLoading && !exam) router.push("/exams");
  }, [examLoading, exam, router]);

  useEffect(() => {
    const draft = draftQuery.data?.draft;
    if (!draft || Object.keys(draft.answers).length === 0) return;
    setAnswers(draft.answers);
    setTimeRemaining(draft.timeRemaining);
    setCurrentPart(draft.currentPart);
    toast.info("Brouillon serveur récupéré");
  }, [draftQuery.data]);

  useEffect(() => {
    if (showInstructions || !id) return;
    const raw = localStorage.getItem(`exam-${id}-draft`);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as {
        answers?: Record<string, string>;
        timeRemaining?: number;
        currentPart?: number;
      };
      setAnswers(saved.answers || {});
      setTimeRemaining(saved.timeRemaining ?? 3600);
      setCurrentPart(saved.currentPart || 1);
      toast.info("Brouillon local récupéré");
    } catch {
      localStorage.removeItem(`exam-${id}-draft`);
    }
  }, [id, showInstructions]);

  useEffect(() => {
    if (showInstructions || !id) return;
    localStorage.setItem(
      `exam-${id}-draft`,
      JSON.stringify({ answers, timeRemaining, currentPart, lastSync: new Date().toISOString() }),
    );
  }, [answers, currentPart, id, showInstructions, timeRemaining]);

  const persistDraft = useCallback(async () => {
    if (showInstructions || !id) return;
    setSaveState("saving");
    try {
      await apiFetch<void>(`/api/exams/${id}/draft`, {
        method: "POST",
        body: JSON.stringify({
          answers: answersRef.current,
          timeRemaining: timeRef.current,
          currentPart: partRef.current,
        }),
      });
      setSaveState("saved");
      setLastSaved(new Date().toLocaleTimeString("fr-FR"));
    } catch {
      setSaveState(navigator.onLine ? "error" : "offline");
    }
  }, [id, showInstructions]);

  useEffect(() => {
    if (showInstructions || !id) return;
    const interval = setInterval(persistDraft, 15_000);
    return () => clearInterval(interval);
  }, [id, persistDraft, showInstructions]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  };

  const requestSubmitConfirmation = () => {
    if (!isSubmitting) setShowSubmitDialog(true);
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitDialog(false);
    submitMutation.mutate(answersRef.current);
  };

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;
  useEffect(() => {
    if (!showInstructions && timeRemaining <= 0 && !isSubmitting) {
      handleSubmitRef.current();
    }
  }, [isSubmitting, showInstructions, timeRemaining]);

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
  const accessibleTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `Temps restant : ${minutes} minute${minutes > 1 ? "s" : ""} et ${remainingSeconds} seconde${remainingSeconds > 1 ? "s" : ""}`;
  };

  if (examLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto mb-3" />
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
        onStart={() => {
          setShowInstructions(false);
          startMutation.mutate();
        }}
      />
    );
  }
  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Redirection...</p>
      </div>
    );
  }

  const parts = exam.parts || [];
  const part1Questions = parts.find(
    (part: ExamPart) => part.type === "QCM" || part.order === 1,
  )?.questions || [];
  const part2Questions = parts.find(
    (part: ExamPart) => part.type === "OPEN" || part.order === 2,
  )?.questions || [];
  const part3 = parts.find((part: ExamPart) => part.type === "CASE_STUDY");
  const part3Questions = part3?.questions || [];
  const hasPart3 = exam.part3Enabled ?? !!part3;
  const allQuestions = [...part1Questions, ...part2Questions];
  const answeredQuestions = allQuestions.filter((question) =>
    (answers[question.id] || "").trim(),
  ).length;
  const hasCompositionAnswer = Boolean((answers.part3 || "").trim());
  const expectedAnswers = allQuestions.length + (hasPart3 ? 1 : 0);
  const answeredCount = answeredQuestions + (hasPart3 && hasCompositionAnswer ? 1 : 0);
  const unansweredCount = expectedAnswers - answeredCount;
  const part1Answered = part1Questions.filter((question) =>
    (answers[question.id] || "").trim(),
  ).length;
  const part2Answered = part2Questions.filter((question) =>
    (answers[question.id] || "").trim(),
  ).length;
  const part3PromptCount = hasPart3 ? 1 : 0;
  const part3Answered = hasPart3 ? Number(hasCompositionAnswer) : 0;
  const saveLabel =
    saveState === "saving"
      ? "Sauvegarde en cours…"
      : saveState === "saved"
        ? `Sauvegardé${lastSaved ? ` à ${lastSaved}` : ""}`
        : saveState === "offline"
          ? "Hors ligne — réponses conservées sur cet appareil"
          : saveState === "error"
            ? "Erreur de sauvegarde — vos réponses restent conservées localement"
            : "Sauvegarde automatique";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-800 text-sm sm:text-base truncate">{exam.name}</h1>
              <p className="text-[10px] sm:text-xs text-slate-500">
                Partie {currentPart} sur {hasPart3 ? 3 : 2}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 pt-3 sm:pt-0">
            <div
              role="timer"
              aria-label={accessibleTime(timeRemaining)}
              aria-live="off"
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg ${timeRemaining < 300 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}
            >
              <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${timeRemaining < 300 ? "animate-pulse" : ""}`} aria-hidden="true" />
              <span className="font-mono font-bold text-sm sm:text-lg" aria-hidden="true">{formatTime(timeRemaining)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={requestSubmitConfirmation}
              disabled={isSubmitting}
              className="gap-2 text-xs sm:text-sm h-8 sm:h-10"
            >
              <Save className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden="true" />
              {isSubmitting ? "Soumission…" : "Soumettre"}
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
          <Progress value={((currentPart - 1) / (hasPart3 ? 2 : 1)) * 100} className="h-2" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 text-xs" role="status">
        {saveState === "offline" && <WifiOff className="inline w-3 h-3 mr-1" aria-hidden="true" />}
        {saveLabel}
        {(saveState === "error" || saveState === "offline") && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 ml-1"
            onClick={persistDraft}
          >
            <RefreshCw className="w-3 h-3 mr-1" aria-hidden="true" />
            Réessayer
          </Button>
        )}
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {currentPart === 1 && (
          <ExamPart1
            questions={part1Questions}
            answers={answers}
            totalPoints={exam.part1Points || 20}
            onAnswerChange={handleAnswerChange}
            onNextPart={() => setCurrentPart(2)}
          />
        )}
        {currentPart === 2 && (
          <ExamPart2
            questions={part2Questions}
            answers={answers}
            totalPoints={exam.part2Points || 40}
            hasPart3={hasPart3}
            isSubmitting={isSubmitting}
            onAnswerChange={handleAnswerChange}
            onBack={() => setCurrentPart(1)}
            onNextPart={() => setCurrentPart(3)}
            onSubmit={requestSubmitConfirmation}
          />
        )}
        {currentPart === 3 && hasPart3 && (
          <ExamPart3
            subject={part3?.scenario || exam.part3Subject || "Sujet non disponible"}
            questions={part3Questions}
            answers={answers}
            totalPoints={exam.part3Points || 40}
            isSubmitting={isSubmitting}
            onAnswerChange={(value) => setAnswers((previous) => ({ ...previous, part3: value }))}
            onBack={() => setCurrentPart(2)}
            onSubmit={requestSubmitConfirmation}
          />
        )}
      </main>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Résumé de votre examen</AlertDialogTitle>
            <AlertDialogDescription>
              Vérifiez vos réponses avant la soumission. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border p-4 text-sm">
            <p><strong>{answeredCount} / {expectedAnswers}</strong> réponses renseignées</p>
            <ul className="mt-3 space-y-1 text-slate-600" aria-label="Détail des réponses">
              <li>Partie 1 — QCM : {part1Answered} / {part1Questions.length}</li>
              <li>Partie 2 — Questions ouvertes : {part2Answered} / {part2Questions.length}</li>
              {hasPart3 && <li>Partie 3 — Étude de cas : {part3Answered} / {part3PromptCount}</li>}
            </ul>
            {unansweredCount > 0 && (
              <p className="mt-3 text-amber-700">
                {unansweredCount} réponse{unansweredCount > 1 ? "s" : ""} sans contenu. Vous pouvez continuer l’examen.
              </p>
            )}
            <p className="mt-3 text-slate-500">Vos réponses sont conservées jusqu’à la confirmation.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuer l’examen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
              disabled={isSubmitting}
            >
              Confirmer la soumission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
