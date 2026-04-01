"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Send,
  AlertTriangle,
  ClipboardList
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";

type Question = {
  id: string;
  text: string;
  type: string;
  options: { id: string, text: string }[];
};

type ExamPart = {
  id: string;
  title: string;
  type: string;
  duration: number;
  scenario?: string;
  questions: Question[];
};

type Exam = {
  id: string;
  title: string;
  parts: ExamPart[];
};

export default function TakeExamPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Charger l'examen
  useEffect(() => {
    if (session) {
      fetch(`/api/candidates/exams/${id}`)
        .then(res => {
          if (!res.ok) throw new Error("Examen inaccessible");
          return res.json();
        })
        .then(data => {
          setExam(data);
          // Calcul du temps global (Somme des durées des parties)
          const totalDuration = data.parts.reduce((acc: number, p: any) => acc + p.duration, 0);
          setTimeLeft(totalDuration * 60);
          setLoading(false);
        })
        .catch(err => {
          toast.error(err.message);
          router.push("/exams");
        });
    }
  }, [id, session, router]);

  // 2. Gestion du Timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isSubmitting) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev && prev <= 1) {
          clearInterval(timer);
          handleSubmit(); // Auto-submit on timeout
          return 0;
        }
        return prev ? prev - 1 : 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSubmitting]);

  // 3. Soumission de l'examen
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch("/api/submissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: id, answers })
      });

      if (!res.ok) throw new Error("Erreur lors de la soumission");
      
      toast.success("Examen soumis avec succès !");
      router.push(`/dashboard/results?examId=${id}`);
    } catch (err) {
      toast.error("Échec de la soumission. Vos réponses sont sauvegardées localement.");
    } finally {
      setIsSubmitting(false);
    }
  }, [id, answers, router, isSubmitting]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
  };

  if (sessionPending || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-slate-500 font-medium">Préparation de votre session d'examen...</p>
      </div>
    );
  }

  if (!exam) return null;

  const currentPart = exam.parts[currentPartIndex];
  const progress = ((currentPartIndex + 1) / exam.parts.length) * 100;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* HEADER FIXE */}
      <Card className="p-6 sticky top-20 z-40 bg-white/90 backdrop-blur-md shadow-xl border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">{exam.title}</h1>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
              Partie {currentPartIndex + 1} / {exam.parts.length} : {currentPart.title}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className={timeLeft && timeLeft < 300 ? "text-rose-600 animate-pulse" : "text-slate-600"}>
            <div className="flex items-center gap-2 font-mono font-bold text-xl">
              <Clock className="w-5 h-5" />
              {timeLeft ? formatTime(timeLeft) : "--:--"}
            </div>
          </div>
          <Button 
            variant="default" 
            className="bg-slate-900 hover:bg-slate-800" 
            onClick={() => {
              if (confirm("Voulez-vous vraiment soumettre l'examen maintenant ?")) handleSubmit();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Terminer
          </Button>
        </div>
      </Card>

      <Progress value={progress} className="h-2 bg-slate-100" />

      {/* ZONE DE COMPOSITION */}
      <div className="space-y-8 pb-20">
        {currentPart.scenario && (
          <Card className="p-8 bg-amber-50 border-amber-100 shadow-inner">
            <h4 className="text-amber-800 font-black uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Analyse de scénario / Étude de cas
            </h4>
            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed italic">
              {currentPart.scenario}
            </div>
          </Card>
        )}

        <div className="space-y-6">
          {currentPart.questions.map((question, qIdx) => (
            <Card key={question.id} className="p-8 border-slate-100 hover:border-emerald-200 transition-colors">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-sm">
                    {qIdx + 1}
                  </span>
                  <p className="text-lg font-bold text-slate-800 pt-0.5">{question.text}</p>
                </div>

                {question.type === "OPEN" || currentPart.type === "CASE_STUDY" ? (
                  <Textarea 
                    placeholder="Saisissez votre réponse détaillée ici..."
                    className="min-h-[200px] bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500/20 text-base"
                    value={answers[question.id] || ""}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  />
                ) : (
                  <div className="grid gap-3 pl-12">
                    {question.options.map((option) => (
                      <label 
                        key={option.id}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          answers[question.id] === option.id 
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold" 
                          : "bg-white border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <input 
                          type="radio" 
                          name={question.id} 
                          className="w-5 h-5 accent-emerald-600"
                          checked={answers[question.id] === option.id}
                          onChange={() => handleAnswerChange(question.id, option.id)}
                        />
                        <span>{option.text}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* NAVIGATION BAS DE PAGE */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 z-50">
        <div className="max-w-5xl mx-auto flex justify-between gap-4">
          <Button 
            variant="outline" 
            size="lg"
            className="rounded-xl border-slate-200"
            disabled={currentPartIndex === 0}
            onClick={() => setCurrentPartIndex(prev => prev - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Précédent
          </Button>
          
          {currentPartIndex < exam.parts.length - 1 ? (
             <Button 
              size="lg"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setCurrentPartIndex(prev => prev + 1)}
             >
               Partie Suivante <ChevronRight className="w-4 h-4 ml-2" />
             </Button>
          ) : (
             <Button 
              size="lg"
              className="rounded-xl bg-slate-900 border-none shadow-xl shadow-slate-900/20"
              onClick={handleSubmit}
              disabled={isSubmitting}
             >
               {isSubmitting ? "Envoi..." : "Soumettre la copie finale"} <Send className="w-4 h-4 ml-2" />
             </Button>
          )}
        </div>
      </div>
    </div>
  );
}
