"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  ListTodo, 
  MessageSquare, 
  BookOpen,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type Exam = {
  id: string;
  title: string;
  parts: Array<{
    id: string;
    title: string;
    type: string;
    duration: number;
    scenario: string | null;
    questions: Array<{
      id: string;
      text: string;
      type: string;
      options: Array<{ id: string, text: string }>;
    }>;
  }>;
};

export function CandidateExamSession({ examId }: { examId: string }) {
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentPart, setCurrentPart] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    fetch(`/api/candidates/exams/${examId}`)
      .then(res => res.json())
      .then(data => {
        setExam(data);
        const totalDuration = data.parts.reduce((sum: number, p: any) => sum + p.duration, 0);
        setTimeLeft(totalDuration * 60);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [examId]);

  useEffect(() => {
    if (!isStarted || timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isStarted, timeLeft]);

  // Submit automatically when time is up
  useEffect(() => {
    if (timeLeft === 0 && isStarted && !submitting) {
      handleSubmit();
      toast.warning("Temps écoulé! Soumission automatique de vos réponses.");
    }
  }, [timeLeft, isStarted]);

  const updateAnswer = (questionId: string, val: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: val }));
  };

  const handleNext = () => setCurrentPart(prev => Math.min(prev + 1, (exam?.parts.length || 1) - 1));
  const handlePrev = () => setCurrentPart(prev => Math.max(prev - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/candidates/exams/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      if (!res.ok) throw new Error("Soumission échouée");
      toast.success("Examen soumis avec succès !");
      router.push("/exams");
    } catch {
      toast.error("Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;
  if (!exam) return <div className="text-center p-20 text-rose-500 font-bold">Examen non trouvé</div>;

  if (!isStarted) {
    return (
      <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
        <div className="text-center space-y-4">
          <Badge className="bg-emerald-100 text-emerald-700 uppercase tracking-widest text-[10px] h-6 px-4">Bienvenue</Badge>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">{exam.title}</h1>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
           <Card className="p-6 text-center space-y-2 border-slate-100 shadow-sm bg-white hover:bg-slate-50 transition-colors">
              <Clock className="w-10 h-10 text-blue-500 mx-auto" />
              <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Temps Total</p>
              <p className="text-2xl font-black text-slate-700">{formatTime(timeLeft || 0)}</p>
           </Card>
           <Card className="p-6 text-center space-y-2 border-slate-100 shadow-sm bg-white hover:bg-slate-50 transition-colors">
              <ListTodo className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Structure</p>
              <p className="text-2xl font-black text-slate-700">{exam.parts.length} Parties</p>
           </Card>
           <Card className="p-6 text-center space-y-2 border-slate-100 shadow-sm bg-white hover:bg-slate-50 transition-colors">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Pointage</p>
              <p className="text-2xl font-black text-slate-700">100 Pts</p>
           </Card>
        </div>

        <Card className="p-8 border-slate-100 shadow-xl space-y-8 bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3 underline decoration-emerald-200 underline-offset-8">
               <FileText className="w-5 h-5 text-emerald-600" /> 
               Instructions de l'examen
            </h2>
            <div className="space-y-4 text-slate-600 leading-relaxed text-sm">
                <p>1. Une fois démarré, le chronomètre ne pourra pas être mis en pause.</p>
                <p>2. Vos réponses sont automatiquement sauvegardées lors de chaque saisie.</p>
                <p>3. L'examen se soumettra automatiquement à l'expiration du délai.</p>
                <p>4. Assurez-vous d'avoir une connexion internet stable tout au long de l'épreuve.</p>
            </div>
          </div>
          <div className="flex justify-center pt-8">
            <Button size="lg" onClick={() => setIsStarted(true)} className="h-16 px-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-2xl shadow-emerald-500/30 gap-4 group">
               Démarrer l'examen maintenant
               <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const activePart = exam.parts[currentPart];
  const progress = ((currentPart + 1) / exam.parts.length) * 100;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-20">
      {/* Sticky Header with Timer & Progress */}
      <div className="sticky top-[68px] z-40 space-y-2 animate-in slide-in-from-top-4 duration-500">
        <Card className="p-4 bg-white/90 backdrop-blur-xl border-slate-200 shadow-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Partie {currentPart + 1}/{exam.parts.length}</span>
            <span className="text-sm font-bold text-slate-800 truncate max-w-[200px] md:max-w-md">{activePart.title}</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className={`px-4 py-2 rounded-full border-2 flex items-center gap-3 transition-all ${
              (timeLeft || 0) < 300 ? 'border-rose-200 bg-rose-50 text-rose-600 scale-105 animate-pulse' : 'border-slate-100 bg-slate-50 text-slate-700'
            }`}>
              <Clock className={`w-4 h-4 ${ (timeLeft || 0) < 300 ? 'text-rose-500' : 'text-slate-400'}`} />
              <span className="text-lg font-black tabular-nums">{formatTime(timeLeft || 0)}</span>
            </div>
            {currentPart === exam.parts.length - 1 ? (
              <Button onClick={handleSubmit} disabled={submitting} className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 font-bold gap-2">
                {submitting ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4" />}
                Soumettre
              </Button>
            ) : (
                <Button onClick={handleNext} className="h-12 px-6 bg-slate-800 hover:bg-slate-900 font-bold gap-2 group">
                  Suivant <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
            )}
          </div>
        </Card>
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-8 mt-12 animate-in fade-in duration-500">
        <div className="space-y-8">
           {activePart.scenario && (
             <Card className="p-8 bg-blue-50/40 border-blue-100 border-2 rounded-3xl relative">
                <div className="absolute top-4 right-6 uppercase text-[10px] font-black text-blue-400 tracking-tighter">Étude de Cas / Mise en situation</div>
                <h4 className="text-lg font-black text-blue-700 mb-6 flex items-center gap-3 items-start leading-tight">
                    <FileText className="w-6 h-6 mt-1" />
                    Lecture du Scénario
                </h4>
                <div className="prose prose-blue prose-sm max-w-none text-blue-900 leading-relaxed opacity-90 whitespace-pre-wrap">
                  {activePart.scenario}
                </div>
             </Card>
           )}

           <div className="space-y-6">
              {activePart.questions.map((q, qIdx) => (
                <Card key={q.id} className="p-8 bg-white border-slate-100 shadow-sm border hover:border-slate-200 transition-all">
                   <div className="space-y-6">
                      <div className="flex gap-4">
                         <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                            <span className="text-lg font-black text-slate-400">{qIdx + 1}</span>
                         </div>
                         <p className="text-xl font-bold text-slate-800 leading-tight pt-1">{q.text}</p>
                      </div>

                      <div className="pl-14 space-y-4">
                         {activePart.type === 'QCM' ? (
                           <div className="grid gap-3">
                              {q.options.map((opt) => (
                                <div 
                                  key={opt.id} 
                                  onClick={() => updateAnswer(q.id, opt.id)}
                                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                                    answers[q.id] === opt.id 
                                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-4 ring-emerald-50' 
                                      : 'bg-white border-slate-100 hover:border-slate-200 text-slate-600'
                                  }`}
                                >
                                   <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                      answers[q.id] === opt.id ? 'border-emerald-600 bg-emerald-600' : 'border-slate-200'
                                   }`}>
                                      {answers[q.id] === opt.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                   </div>
                                   <span className="font-semibold">{opt.text}</span>
                                </div>
                              ))}
                           </div>
                         ) : (
                           <Textarea 
                             placeholder="Rédigez votre réponse ici..."
                             value={answers[q.id] || ""}
                             onChange={(e) => updateAnswer(q.id, e.target.value)}
                             className="min-h-[180px] bg-slate-50/50 border-slate-100 focus:bg-white text-base leading-relaxed p-6 rounded-2xl focus:ring-emerald-500"
                           />
                         )}
                      </div>
                   </div>
                </Card>
              ))}
           </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-12 border-t px-6">
           <Button variant="ghost" onClick={handlePrev} disabled={currentPart === 0} className="h-12 px-6 gap-2 text-slate-500">
              <ChevronLeft className="w-5 h-5" /> Partie Précédente
           </Button>
           <div className="hidden md:flex gap-2">
              {exam.parts.map((p, i) => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all duration-500 ${currentPart === i ? 'bg-emerald-500 scale-125' : 'bg-slate-200'}`} />
              ))}
           </div>
           {currentPart === exam.parts.length - 1 ? (
             <Button onClick={handleSubmit} disabled={submitting} className="h-14 px-12 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20">
                {submitting ? <Loader2 className="animate-spin" /> : "Terminer l'examen"}
             </Button>
           ) : (
             <Button onClick={handleNext} className="h-14 px-12 bg-slate-800 hover:bg-slate-900 rounded-2xl font-black text-lg gap-2 group">
                Passer à la suite <ChevronRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
             </Button>
           )}
        </div>
      </div>
    </div>
  );
}
