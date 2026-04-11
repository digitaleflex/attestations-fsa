"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { 
  Clock, AlertCircle, CheckCircle, ChevronRight, ChevronLeft, 
  BookOpen, FileText, PenTool, Eye, Save, Upload, Trash2, Image as ImageIcon,
  ShieldCheck
} from "lucide-react";

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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useExamMonitoring, reportMonitoringEvents, MonitoringEvent, MonitoringState } from "@/lib/useExamMonitoring";

interface QuestionOption {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  options?: QuestionOption[];
}

interface ExamPart {
  id: string;
  order: number;
  type: string;
  scenario?: string;
  mode?: string;
  questions: Question[];
}

interface ExamData {
  id: string;
  name: string;
  description: string;
  duration: number;
  part1Enabled: boolean;
  part2Enabled: boolean;
  part3Enabled: boolean;
  part1Points: number;
  part2Points: number;
  part3Points: number;
  part1Questions: number;
  part2Questions: number;
  part3Mode: string;
  part3Subject: string | null;
  passingScore: number;
  randomizeQuestions: boolean;
  showResults: boolean;
  status: string;
  totalPoints: number;
  parts: ExamPart[];
}

interface ExamSessionResponse {
  id: string;
  duration: number;
}

interface ScanData {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  pageNumber: number;
}

export default function ExamSessionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  
  // États de navigation
  const [currentPart, setCurrentPart] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600); // 60 minutes par défaut
  const [showInstructions, setShowInstructions] = useState(true);
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [showPart3Subject, setShowPart3Subject] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [scans, setScans] = useState<ScanData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Timer reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ ANTI-CHEAT: Exam monitoring (DISABLED by request)
  /*
  const monitoring = useExamMonitoring({
// ...
  });
  */

  // Fetch exam data
  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => apiFetch(`/api/exams/${id}`) as Promise<ExamData>,
    staleTime: 5 * 60 * 1000,
  });

  // Start exam session
  const startMutation = useMutation<ExamSessionResponse, Error, void>({
    mutationFn: () => apiFetch<ExamSessionResponse>(`/api/exams/${id}/start`, { method: "POST" }),
    onSuccess: (data: ExamSessionResponse) => {
      setTimeRemaining(data.duration || 3600);
      setSessionId(data.id); // Guardar el ID de session para los scans
      startTimer();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible de démarrer l'examen");
      router.push("/exams");
    }
  });

  // Submit exam
  const submitMutation = useMutation<void, Error, Record<string, string>>({
    mutationFn: (finalAnswers: Record<string, string>) => 
      apiFetch<void>(`/api/exams/${id}/submit?v=${Date.now()}`, {
        method: "POST",
        body: JSON.stringify({ answers: finalAnswers }),
      }),
    onSuccess: () => {
      toast.success("✅ Examen soumis avec succès !");
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(`exam-${id}-draft`);
      }
      router.push("/results");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de la soumission. Vos réponses sont sauvegardées localement.");
      setIsSubmitting(false);
    },
  });

  // Timer
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle answer change
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev: Record<string, string>) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  // Handle Part 3 text change
  const handlePart3Change = (value: string) => {
    setAnswers((prev: Record<string, string>) => ({
      ...prev,
      part3: value,
    }));
  };

  // Start exam
  const handleStart = () => {
    setShowInstructions(false);
    startMutation.mutate();
  };

  // Submit exam
  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    // ANTI-CHEAT: Report monitoring events DISABLED

    submitMutation.mutate(answers);

    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !sessionId) return;

    setIsUploading(true);
    const file = files[0];

    try {
        // En un entorno real, subiríamos a S3/Cloudinary aquí.
        // Simulamos el upload convirtiendo a Base64 para el demo o usando un placeholder
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            
            // On appelle notre nouvelle API
            const res = await fetch(`/api/user/exams/session/${sessionId}/scans`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: base64String, // On stocke le base64 pour le moment (démo)
                    fileName: file.name,
                    fileSize: file.size,
                    pageNumber: scans.length + 1
                })
            });

            if (!res.ok) throw new Error("Échec de l'upload");
            
            const data = await res.json();
            setScans(prev => [...prev, data.scan]);
            toast.success("Page ajoutée avec succès !");
        };
        reader.readAsDataURL(file);
    } catch (error) {
        toast.error("Erreur lors de l'envoi du fichier");
    } finally {
        setIsUploading(false);
    }
  };

  // 💾 SAUVEGARDE INSTANTANÉE & AUTOMATIQUE
  useEffect(() => {
    if (showInstructions || !id) return;
    
    const saveDraft = () => {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(`exam-${id}-draft`, JSON.stringify({
          answers,
          timeRemaining,
          currentPart,
          lastSync: new Date().toISOString()
        }));
      }
    };

    // Sauvegarde immédiate lors des changements importants
    saveDraft();
  }, [answers, currentPart, id, showInstructions]);

  // Sauvegarde du temps toutes les 10 secondes (plus fréquent pour mobile)
  useEffect(() => {
    if (showInstructions) return;

    const timeInterval = setInterval(() => {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const draft = localStorage.getItem(`exam-${id}-draft`);
        const currentDraft = draft ? JSON.parse(draft) : { answers: {} };
        
        localStorage.setItem(`exam-${id}-draft`, JSON.stringify({
          ...currentDraft,
          timeRemaining,
          currentPart
        }));
      }
    }, 10000);

    return () => clearInterval(timeInterval);
  }, [timeRemaining, currentPart, id, showInstructions]);

  // Load draft on mount
  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const draft = localStorage.getItem(`exam-${id}-draft`);
    if (draft) {
      try {
        const saved = JSON.parse(draft);
        setAnswers(saved.answers || {});
        setTimeRemaining(saved.timeRemaining || 3600);
        setCurrentPart(saved.currentPart || 1);
        toast.info("📝 Brouillon récupéré automatiquement");
      } catch (e) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`exam-${id}-draft`);
        }
      }
    }
  }, [id]);

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

  // Instructions Screen
  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 bg-white shadow-lg">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">{exam?.name}</h1>
              <p className="text-slate-600">{exam?.description}</p>
            </div>

            <div className="space-y-6 mb-8">
              <Alert className="bg-blue-50 border-blue-200">
                <Clock className="w-5 h-5 text-blue-600" />
                <AlertTitle className="text-blue-800">Durée de l'examen</AlertTitle>
                <AlertDescription className="text-blue-700">
                  {exam?.duration ? `${Math.round(exam.duration / 60)} minutes` : "60 minutes"}
                  {" "}pour compléter toutes les parties.
                </AlertDescription>
              </Alert>

              <Alert className="bg-emerald-50 border-emerald-200">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <AlertTitle className="text-emerald-800">Barème de notation</AlertTitle>
                <AlertDescription className="text-emerald-700">
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {exam?.part1Enabled && (
                      <li><strong>Partie 1 (QCM)</strong> : {exam.part1Points} points - Correction automatique</li>
                    )}
                    {exam?.part2Enabled && (
                      <li><strong>Partie 2 (Questions ouvertes)</strong> : {exam.part2Points} points - Correction par l'admin</li>
                    )}
                    {exam?.part3Enabled && (
                      <li><strong>Partie 3 (Étude de cas)</strong> : {exam.part3Points} points - Correction par l'admin</li>
                    )}
                  </ul>
                  <p className="mt-3 font-semibold">
                    🎯 Note minimale requise : <span className="text-emerald-700 font-bold">
                      {exam?.passingScore || 65}% soit {Math.round(((exam?.passingScore || 65) / 100) * 20)}/20
                    </span> pour obtenir l'attestation
                  </p>
                </AlertDescription>
              </Alert>

              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <AlertTitle className="text-amber-800">⚠️ Important - Partie 3 : Étude de cas</AlertTitle>
                <AlertDescription className="text-amber-700">
                  <div className="space-y-2 mt-2 text-sm">
                    <p>
                      <strong>📋 Déroulement :</strong>
                    </p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Vous découvrirez d'abord le <strong>sujet de l'étude de cas</strong></li>
                      <li>Vous devrez rédiger vos réponses sur des <strong>feuilles de composition</strong></li>
                      <li>
                        <strong>🔍 Visibilité Admin :</strong> Les administrateurs pourront voir vos feuilles de composition 
                        lors de la correction. Soyez donc clair et structuré dans vos réponses.
                      </li>
                      <li>
                        <strong>📝 Conseils :</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>Numérotez vos pages</li>
                          <li>Écrivez lisiblement</li>
                          <li>Structurez votre réponse (introduction, développement, conclusion)</li>
                          <li>Justifiez vos choix et raisonnements</li>
                        </ul>
                      </li>
                    </ol>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert className="bg-purple-50 border-purple-200">
                <Save className="w-5 h-5 text-purple-600" />
                <AlertTitle className="text-purple-800">Sauvegarde automatique</AlertTitle>
                <AlertDescription className="text-purple-700">
                  Vos réponses sont sauvegardées automatiquement toutes les 30 secondes.
                  En cas de problème technique, vous pourrez reprendre où vous vous êtes arrêté.
                </AlertDescription>
              </Alert>

              <Alert className="bg-indigo-50 border-indigo-200">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <AlertTitle className="text-indigo-800 font-bold uppercase tracking-wider">🔒 CHARTE D&apos;INTÉGRITÉ ACADÉMIQUE - SESSION MOBILE</AlertTitle>
                <AlertDescription className="text-indigo-700">
                  <div className="space-y-4 mt-3">
                    <p className="font-bold underline decoration-indigo-300 text-sm">Précautions obligatoires pour composer sur Smartphone :</p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 list-none mt-2">
                        <li className="flex items-center gap-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] shrink-0 font-bold">1</span>
                            <span><strong>Mode "Ne pas déranger"</strong> vivement conseillé</span>
                        </li>
                        <li className="flex items-center gap-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] shrink-0 font-bold">2</span>
                            <span><strong>Interdiction de changer d&apos;application</strong></span>
                        </li>
                        <li className="flex items-center gap-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] shrink-0 font-bold">3</span>
                            <span><strong>Batterie chargée</strong> (minimum 50%)</span>
                        </li>
                        <li className="flex items-center gap-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] shrink-0 font-bold">4</span>
                            <span><strong>Appui externe interdit</strong> (IA, Recherche Google)</span>
                        </li>
                    </ul>
                    
                    <div className="p-4 bg-white/60 rounded-2xl border border-indigo-200 text-[11px] leading-relaxed">
                        <p className="mb-2">📱 <strong>AVIS AUX CANDIDATS SUR MOBILE :</strong> Vous avez choisi de composer sur smartphone. Votre navigation est surveillée. Un changement d&apos;onglet ou de fenêtre (répondre à un message, appel entrant) peut être détecté comme une tentative de fraude.</p>
                        <p>Tout événement suspect est enregistré nominativement. Restez concentré sur cette page jusqu&apos;à la fin de l&apos;épreuve.</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>


            </div>

            <div className="flex flex-col items-center justify-center gap-6 py-8 border-t border-slate-100">
               <label className="flex items-start gap-3 cursor-pointer group max-w-lg px-4">
                    <input 
                        type="checkbox" 
                        checked={agreedToRules}
                        onChange={(e) => setAgreedToRules(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 transition-all cursor-pointer"
                    />
                    <span className="text-sm font-bold text-slate-700 group-hover:text-red-700 transition-colors">
                        Je déclare avoir lu les règles et je m&apos;engage sur l&apos;honneur à respecter la charte d&apos;intégrité de la FSA.
                    </span>
               </label>

              <Button
                onClick={handleStart}
                size="lg"
                disabled={!agreedToRules}
                className={cn(
                    "gap-3 px-12 h-14 text-lg font-black rounded-2xl transition-all duration-300 tracking-tighter",
                    agreedToRules 
                        ? "bg-gradient-to-r from-red-600 to-rose-600 hover:scale-105 active:scale-95 shadow-xl shadow-red-200 text-white" 
                        : "bg-slate-200 text-slate-400 grayscale cursor-not-allowed"
                )}
              >
                <CheckCircle className="w-6 h-6" />
                DÉMARRER MON EXAMEN
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Exam Interface - Extraction des questions depuis les parties
  const parts = exam?.parts || [];
  const part1Questions = parts.find((p: ExamPart) => (p.order === 1 && p.type === "QCM") || p.type === "QCM")?.questions || [];
  const part2Questions = parts.find((p: ExamPart) => (p.order === 2 && p.type === "OPEN") || p.type === "OPEN")?.questions || [];
  
  const part3 = parts.find((p: ExamPart) => p.type === "CASE_STUDY");
  const part3Questions = part3?.questions || [];
  const part3Subject = part3?.scenario || exam?.part3Subject || "Sujet non disponible";
  
  const hasPart3 = exam?.part3Enabled ?? (!!part3);
  const part3Mode = part3?.mode || exam?.part3Mode || "digital"; 

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header with Timer */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        {/* ✅ ANTI-CHEAT: Warning banner DISABLED */}
        {/*
        {monitoring.totalSuspiciousEvents > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
// ...
          </div>
        )}
        */}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-800 text-sm sm:text-base truncate">{exam?.name}</h1>
                <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" title="Mode Sécurisé - Anti-triche désactivé" />
              </div>
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

        {/* Progress Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
          <Progress 
            value={((currentPart - 1) / (hasPart3 ? 2 : 1)) * 100} 
            className="h-2"
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Part 1: QCM */}
        {currentPart === 1 && (
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Partie 1 - QCM</h2>
                <p className="text-sm text-slate-500">
                  {part1Questions.length} questions • {exam?.part1Points || 20} points
                </p>
              </div>
            </div>

            {part1Questions.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">
                    Question {currentQuestion + 1} sur {part1Questions.length}
                  </p>
                  <Badge variant="outline">
                    {Math.round(((currentQuestion) / part1Questions.length) * 100)}% complété
                  </Badge>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-base font-medium text-slate-800 mb-4">
                    {part1Questions[currentQuestion]?.text}
                  </p>

                  <RadioGroup
                    value={answers[part1Questions[currentQuestion]?.id] || ""}
                    onValueChange={(value) =>
                      handleAnswerChange(part1Questions[currentQuestion]?.id, value)
                    }
                    className="space-y-3"
                  >
                    {part1Questions[currentQuestion]?.options?.map((option: QuestionOption, idx: number) => (
                      <div
                        key={option.id}
                        className="flex items-center space-x-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => handleAnswerChange(part1Questions[currentQuestion]?.id, option.id)}
                      >
                        <RadioGroupItem value={option.id} id={option.id} />
                        <Label
                          htmlFor={option.id}
                          className="flex-1 cursor-pointer text-sm text-slate-700"
                        >
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

                  {currentQuestion < part1Questions.length - 1 ? (
                    <Button
                      onClick={() => setCurrentQuestion((prev) => prev + 1)}
                      className="gap-2 text-sm h-10"
                    >
                      Suivant
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCurrentPart(2)}
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
        )}

        {/* Part 2: Questions ouvertes */}
        {currentPart === 2 && (
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <PenTool className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Partie 2 - Questions ouvertes</h2>
                <p className="text-sm text-slate-500">
                  {part2Questions.length} questions • {exam?.part2Points || 40} points
                </p>
              </div>
            </div>

            <Alert className="bg-purple-50 border-purple-200 mb-6">
              <Eye className="w-4 h-4 text-purple-600" />
              <AlertTitle className="text-purple-800">Visibilité Admin</AlertTitle>
              <AlertDescription className="text-purple-700 text-sm">
                Les administrateurs verront vos réponses lors de la correction. 
                Soyez clair et précis dans vos réponses.
              </AlertDescription>
            </Alert>

            <div className="space-y-6">
              {part2Questions.map((question: Question, idx: number) => (
                <div key={question.id} className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-semibold text-slate-700 mb-3">
                    Question {idx + 1}
                  </p>
                  <p className="text-base text-slate-800 mb-4">
                    {question.text}
                  </p>
                  <Textarea
                    value={answers[question.id] || ""}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Rédigez votre réponse ici..."
                    rows={5}
                    className="resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-2 text-right">
                    {(answers[question.id] || "").length} caractères
                  </p>
                </div>
              ))}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPart(1)}
                    className="gap-2 text-sm h-10"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Retour Partie 1
                  </Button>

                  {hasPart3 ? (
                    <Button
                      onClick={() => {
                        setCurrentPart(3);
                        setShowPart3Subject(false);
                      }}
                      className="gap-2 bg-gradient-to-r from-purple-600 to-amber-600 text-sm h-10"
                    >
                      Partie 3 - Étude de cas
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
                      <AlertDialogTrigger asChild>
                        <Button
                          className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 shadow-lg shadow-emerald-200 text-sm h-10"
                        >
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
                          onClick={(e) => {
                            e.preventDefault();
                            handleSubmit();
                          }}
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
        )}

        {/* Part 3: Étude de cas */}
        {currentPart === 3 && hasPart3 && (
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Partie 3 - Étude de cas</h2>
                <p className="text-sm text-slate-500">
                  {exam?.part3Points || 40} points • {part3Mode === "digital" ? "Réponse numérique" : "Feuilles de composition"}
                </p>
              </div>
            </div>

            {!showPart3Subject ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
                  <Eye className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  Prêt à découvrir le sujet ?
                </h3>
                
                {part3Mode === "physical" ? (
                  <Alert className="bg-amber-50 border-amber-200 max-w-lg mx-auto mb-6 text-left">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <AlertTitle className="text-amber-800">📄 Mode Physique - Feuilles de composition</AlertTitle>
                    <AlertDescription className="text-amber-700 text-sm">
                      <p className="mt-2">
                        Vous allez rédiger votre réponse sur des <strong>feuilles de composition physiques</strong>.
                      </p>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li>Utilisez les feuilles fournies par l'administrateur</li>
                        <li>Numérotez clairement chaque page</li>
                        <li>Écrivez lisiblement</li>
                        <li>Les administrateurs scanneront vos copies pour correction</li>
                        <li>Une fois terminé, cliquez sur "J'ai terminé ma composition"</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-blue-50 border-blue-200 max-w-lg mx-auto mb-6 text-left">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    <AlertTitle className="text-blue-800">📝 Mode Numérique - Réponse en ligne</AlertTitle>
                    <AlertDescription className="text-blue-700 text-sm">
                      <p className="mt-2">
                        Vous allez rédiger votre réponse <strong>directement dans cette interface</strong>.
                      </p>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li>Rédigez dans la zone de texte ci-dessous</li>
                        <li>Structurez votre réponse (paragraphes, titres)</li>
                        <li>La sauvegarde est automatique</li>
                        <li>Les administrateurs corrigeront votre réponse en ligne</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-slate-600 mb-6 max-w-md mx-auto">
                  {part3Mode === "digital" 
                    ? "Une fois le sujet révélé, vous devrez rédiger votre réponse dans la zone de texte."
                    : "Une fois le sujet révélé, préparez vos feuilles de composition."}
                </p>

                <Button
                  onClick={() => setShowPart3Subject(true)}
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600"
                >
                  <Eye className="w-5 h-5" />
                  Découvrir le sujet
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {part3Mode === "physical" ? (
                  <>
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <AlertTitle className="text-amber-800">📄 Instructions - Mode Physique</AlertTitle>
                      <AlertDescription className="text-amber-700 text-sm">
                        <p className="mt-2">
                          Rédigez votre réponse sur les feuilles de composition fournies.
                        </p>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                          <li>Inscrivez votre nom sur chaque page</li>
                          <li>Numérotez vos pages (1/?, 2/?, ...)</li>
                          <li>Structurez votre réponse</li>
                          <li>Les admins corrigeront vos copies scannées</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <h3 className="font-bold text-slate-800 mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Énoncé du Cas / Sujet :
                      </h3>
                      <div className="prose prose-slate max-w-none">
                        <p className="text-base text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {part3Subject}
                        </p>
                      </div>
                    </div>

                    {part3Questions.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Questions à traiter :
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {part3Questions.map((q, idx) => (
                                    <div key={q.id} className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                                        <p className="font-bold text-blue-900 text-sm mb-1">Question {idx + 1}</p>
                                        <p className="text-slate-700 font-medium">{q.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <Label className="text-sm font-bold text-slate-700 uppercase tracking-widest">
                            Vos scans de composition ({scans.length})
                        </Label>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {scans.map((scan, idx) => (
                                <div key={scan.id || idx} className="relative group aspect-[3/4] rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-sm transition-all hover:border-emerald-500">
                                    <img src={scan.url} alt={`Scan ${idx + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Badge className="bg-white text-slate-900 absolute top-2 left-2">P. {scan.pageNumber}</Badge>
                                        <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => {
                                            setScans(prev => prev.filter(s => s.id !== scan.id));
                                            toast.info("Page retirée (simulé)");
                                        }}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            
                            <label className={cn(
                                "flex flex-col items-center justify-center aspect-[3/4] rounded-xl border-2 border-dashed border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer transition-all",
                                isUploading && "opacity-50 pointer-events-none"
                            )}>
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                {isUploading ? (
                                    <div className="flex flex-col items-center gap-2 text-emerald-600">
                                        <div className="animate-spin w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full" />
                                        <span className="text-[10px] font-bold">Envoi...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                            <Upload className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Ajouter une page</span>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    <Alert className="bg-emerald-50 border-emerald-200">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <AlertTitle className="text-emerald-800">Composition terminée ?</AlertTitle>
                      <AlertDescription className="text-emerald-700 text-sm">
                        <p className="mt-2 text-emerald-600 font-medium">
                            Une fois que vous avez ajouté toutes les pages de votre composition, vous pouvez soumettre votre examen définitvement.
                        </p>
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <>
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertCircle className="w-5 h-5 text-blue-600" />
                      <AlertTitle className="text-blue-800">📝 Feuille de composition numérique</AlertTitle>
                      <AlertDescription className="text-blue-700 text-sm">
                        <p className="mt-2">
                          Rédigez votre réponse ci-dessous. Les administrateurs verront cette réponse lors de la correction.
                        </p>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                          <li>Soyez clair et structuré</li>
                          <li>Développez vos arguments</li>
                          <li>Justifiez vos choix</li>
                          <li>La sauvegarde est automatique</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <h3 className="font-bold text-slate-800 mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Énoncé du Cas / Sujet :
                      </h3>
                      <div className="prose prose-slate max-w-none">
                        <p className="text-base text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {part3Subject}
                        </p>
                      </div>
                    </div>

                    {part3Questions.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Questions à traiter :
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {part3Questions.map((q, idx) => (
                                    <div key={q.id} className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                                        <p className="font-bold text-blue-900 text-sm mb-1">Question {idx + 1}</p>
                                        <p className="text-slate-700 font-medium">{q.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                      <Label htmlFor="part3" className="text-sm font-semibold text-slate-700 mb-2 block">
                        Votre réponse :
                      </Label>
                      <Textarea
                        id="part3"
                        value={answers.part3 || ""}
                        onChange={(e) => handlePart3Change(e.target.value)}
                        placeholder="Rédigez votre réponse à l'étude de cas ici..."
                        rows={15}
                        className="resize-none font-serif"
                      />
                      <p className="text-xs text-slate-400 mt-2 text-right">
                        {(answers.part3 || "").length} caractères
                      </p>
                    </div>
                  </>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentPart(2);
                      setShowPart3Subject(false);
                    }}
                    className="gap-2 text-sm h-10"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Retour Partie 2
                  </Button>

                  <Button
                    onClick={handleSubmit}
                    className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 text-sm h-10"
                    disabled={isSubmitting || (part3Mode === "digital" && !answers.part3)}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Soumission...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        {part3Mode === "physical" ? "Terminer la composition" : "Terminer et soumettre"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
