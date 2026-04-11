"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  ChevronLeft, 
  Award, 
  Save,
  AlertCircle,
  ClipboardList,
  Eye,
  CheckCircle,
  XCircle,
  PenTool
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";

interface Scan {
  id: string;
  url: string;
  pageNumber: number;
  fileName: string;
}

interface ExamPart {
  id: string;
  title: string;
  type: string;
  order?: number;
  scenario?: string;
  questions: Array<{ 
    id: string; 
    text: string;
    options: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>;
}
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
import { cn } from "@/lib/utils";

type Submission = {
  id: string;
  examId: string;
  status: string;
  scorePart1: number;
  scorePart2: number;
  scorePart3: number;
  totalScore: number;
  internshipScore?: number;
  answers: Record<string, string>;
  submittedAt: string;
  scans: Scan[];
  candidate: { name: string; email: string };
  exam: {
    title: string;
    parts: ExamPart[];
    part1Points: number;
    part2Points: number;
    part3Points: number;
    totalPoints: number;
  };
};

export default function GradeSubmissionPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const [score3, setScore3] = useState<number>(0);
  const [maxP1, setMaxP1] = useState<number>(20);
  const [maxP2, setMaxP2] = useState<number>(40);
  const [maxP3, setMaxP3] = useState<number>(40);
  const [internshipScore, setInternshipScore] = useState<number>(10); // Par défaut 10/20
  const [obs, setObs] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch(`/api/submissions/${id}`) // Assuming a GET route exists or we use the submission API
      .then(res => res.json())
      .then(data => {
        setSubmission(data);
        setScore1(data.scorePart1 || 0);
        setScore2(data.scorePart2 || 0);
        setScore3(data.scorePart3 || 0);
        
        // Barème par défaut : 5 / 10 / 5 pour les examens officiels, sinon les points de l'examen
        if (data.exam.type === 'OFFICIAL') {
          setMaxP1(5);
          setMaxP2(10);
          setMaxP3(5);
        } else {
          setMaxP1(data.exam.part1Points || 20);
          setMaxP2(data.exam.part2Points || 40);
          setMaxP3(data.exam.part3Points || 40);
        }
        // Note de stage stockée sur 100, on affiche sur 20
        if (data.internshipScore) {
          setInternshipScore(data.internshipScore / 5);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!submission) return;

    const maxPart2 = submission.exam.part2Points || 40;
    const maxPart3 = submission.exam.part3Points || 40;

    if (score2 > maxPart2 || score3 > maxPart3) {
      toast.error(`Le score max est de ${maxPart2} pour la P2 et ${maxPart3} pour la P3.`);
      return;
    }
    
    setIsSaving(true);
    try {
      await apiFetch(`/api/admin/submissions/${id}/correct`, {
        method: "POST",
        body: JSON.stringify({
          part1Score: parseFloat(score1.toString()),
          part2Score: parseFloat(score2.toString()),
          part3Score: parseFloat(score3.toString()),
          maxPart1: parseFloat(maxP1.toString()),
          maxPart2: parseFloat(maxP2.toString()),
          maxPart3: parseFloat(maxP3.toString()),
          internshipScore: parseFloat(internshipScore.toString()),
          observations: obs
        })
      });

      toast.success("Notation enregistrée !");
      router.push("/admin/submissions");
    } catch (err) {
      // toast is already handled by apiFetch
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-slate-500 font-medium">Chargement de la copie...</p>
      </div>
    );
  }

  if (!submission) return null;

  const totalRaw = score1 + score2 + score3;
  const totalMax = maxP1 + maxP2 + maxP3;
  
  const examScoreOn20 = (totalRaw / totalMax) * 20;
  const internshipOn20 = internshipScore; // Déjà sur 20
  const finalScoreOn20 = (examScoreOn20 + internshipOn20) / 2;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-32">
      {/* Header Premium & Responsive */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 sticky top-4 z-20 backdrop-blur-xl bg-white/90">
        <div className="flex items-center gap-4">
          <Link href="/admin/submissions">
            <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-slate-100 h-12 w-12 transition-all">
              <ChevronLeft className="w-6 h-6 text-slate-600" />
            </Button>
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Correcteur v2.1</span>
               {submission.status === 'GRADED' && (
                  <Badge className="bg-amber-50 text-amber-600 border-amber-100 text-[9px] uppercase font-black tracking-widest px-2 py-0">
                    MODIFICATION
                  </Badge>
               )}
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">Correction de Copie</h1>
            <p className="text-[10px] font-mono text-slate-400 truncate max-w-[120px] md:max-w-none">ID: {submission.id}</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between md:justify-end gap-6 md:gap-8 pt-4 md:pt-0 border-t md:border-t-0 border-slate-50">
          <div className="text-left md:text-right shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Score Final</p>
            <p className="text-3xl font-black text-indigo-600 flex items-baseline gap-1">
               {finalScoreOn20.toFixed(2)} 
               <span className="text-sm text-slate-300 font-bold">/ 20</span>
            </p>
          </div>
          <Button 
            disabled={isSaving} 
            onClick={() => setShowConfirm(true)} 
            className={cn(
              "h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest transition-all gap-3 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0",
              submission.status === 'GRADED' 
                ? "bg-amber-600 hover:bg-amber-700 text-white" 
                : "bg-slate-900 hover:bg-slate-800 text-white"
            )}
          >
            {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
            <span className="hidden sm:inline">{submission.status === 'GRADED' ? "Actualiser" : "Enregistrer"}</span>
            <span className="sm:hidden">OK</span>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* INFOS CANDIDAT */}
        <div className="space-y-6">
          <Card className="p-6 border-slate-100 shadow-sm bg-white">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-500" /> Profil Candidat
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Nom complet</p>
                <p className="text-slate-800 font-medium">{submission.candidate?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Email</p>
                <p className="text-slate-800">{submission.candidate?.email || "N/A"}</p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Examen</p>
                <p className="text-slate-900 font-black uppercase text-sm mt-1">{submission.exam.title}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-900 text-white shadow-xl">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Save className="w-4 h-4 text-emerald-400" /> Saisie des notes
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase text-slate-400">Partie 1</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Barème:</span>
                    <input 
                      type="number" 
                      className="w-10 bg-transparent border-b border-slate-700 text-[10px] text-emerald-400 font-bold text-center focus:outline-none"
                      value={maxP1}
                      onChange={(e) => setMaxP1(Number(e.target.value))}
                    />
                  </div>
                </div>
                <Input 
                  type="number" 
                  max={maxP1}
                  step="0.5"
                  className="bg-slate-800 border-slate-700 text-emerald-400 text-lg h-12 font-black"
                  value={score1}
                  onChange={(e) => setScore1(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase text-slate-400">Partie 2</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Barème:</span>
                    <input 
                      type="number" 
                      className="w-10 bg-transparent border-b border-slate-700 text-[10px] text-slate-400 font-bold text-center focus:outline-none"
                      value={maxP2}
                      onChange={(e) => setMaxP2(Number(e.target.value))}
                    />
                  </div>
                </div>
                <Input 
                  type="number" 
                  max={maxP2}
                  step="0.5"
                  className="bg-slate-800 border-slate-700 text-white text-lg h-12"
                  value={score2}
                  onChange={(e) => setScore2(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase text-slate-400">Partie 3</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Barème:</span>
                    <input 
                      type="number" 
                      className="w-10 bg-transparent border-b border-slate-700 text-[10px] text-slate-400 font-bold text-center focus:outline-none"
                      value={maxP3}
                      onChange={(e) => setMaxP3(Number(e.target.value))}
                    />
                  </div>
                </div>
                <Input 
                  type="number" 
                  max={maxP3}
                  step="0.5"
                  className="bg-slate-800 border-slate-700 text-white text-lg h-12"
                  value={score3}
                  onChange={(e) => setScore3(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400">Note de Stage (Sur 20)</label>
                <div className="relative">
                   <Input 
                    type="number" 
                    max={20}
                    step="0.5"
                    className="bg-blue-900/50 border-blue-700 text-blue-100 text-lg h-12"
                    value={internshipScore}
                    onChange={(e) => setInternshipScore(Number(e.target.value))}
                  />
                  <div className="absolute right-3 top-3">
                     <Award className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
                <p className="text-[10px] text-blue-300/60 font-medium">L'évaluation finale sera la moyenne : (Examen + Stage) / 2</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400">Observations</label>
                <Textarea 
                  placeholder="Commentaire pour le candidat..."
                  className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* CONTENU DE LA COPIE */}
        <div className="lg:col-span-2 space-y-8">
           {/* PARTIE 1 - QCM (Récupérée auto) */}
           <Card className="p-8 border-emerald-100 bg-emerald-50/20">
            {/* Partie 1 */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs">P1</span>
                  Partie 1 : QCM
                </h3>
                <Badge variant="outline" className="w-fit">Corrigé Automatiquement</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note Obtenue</label>
                  <Input 
                    type="number" 
                    value={score1} 
                    onChange={(e) => setScore1(parseFloat(e.target.value) || 0)}
                    className="h-11 font-bold text-blue-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note Maximale (Barème)</label>
                  <Input 
                    type="number" 
                    value={maxP1} 
                    onChange={(e) => setMaxP1(parseFloat(e.target.value) || 1)}
                    className="h-11 bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* Partie 2 */}
            <div className="space-y-4 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-8 h-8 rounded bg-purple-100 text-purple-600 flex items-center justify-center text-xs">P2</span>
                  Partie 2 : Questions Ouvertes
                </h3>
                <Badge variant="outline" className="w-fit bg-purple-50">Correction Manuelle</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note Obtenue</label>
                  <Input 
                    type="number" 
                    value={score2} 
                    onChange={(e) => setScore2(parseFloat(e.target.value) || 0)}
                    className="h-11 font-bold text-purple-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note Maximale (Barème)</label>
                  <Input 
                    type="number" 
                    value={maxP2} 
                    onChange={(e) => setMaxP2(parseFloat(e.target.value) || 1)}
                    className="h-11 bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* Partie 3 */}
            <div className="space-y-4 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-8 h-8 rounded bg-amber-100 text-amber-600 flex items-center justify-center text-xs">P3</span>
                  Partie 3 : Étude de Cas
                </h3>
                <Badge variant="outline" className="w-fit bg-amber-50">Correction Manuelle</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note Obtenue</label>
                  <Input 
                    type="number" 
                    value={score3} 
                    onChange={(e) => setScore3(parseFloat(e.target.value) || 0)}
                    className="h-11 font-bold text-amber-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note Maximale (Barème)</label>
                  <Input 
                    type="number" 
                    value={maxP3} 
                    onChange={(e) => setMaxP3(parseFloat(e.target.value) || 1)}
                    className="h-11 bg-slate-50"
                  />
                </div>
              </div>
            </div>
              
              <div className="space-y-4 mt-4">
                {submission.exam.parts.find(p => p.type === "QCM")?.questions.map((q, idx) => {
                  const selectedOptionId = submission.answers?.[q.id];
                  const selectedOption = q.options?.find((o: { id: string; text: string }) => o.id === selectedOptionId);
                  const correctOption = q.options?.find((o: { id: string; isCorrect: boolean }) => o.isCorrect);
                  const isCorrect = selectedOptionId === correctOption?.id;

                  return (
                    <div key={q.id} className="text-xs border-l-2 border-slate-200 pl-4 py-1">
                      <p className="font-bold text-slate-700">{idx + 1}. {q.text}</p>
                      <p className={cn("mt-1", isCorrect ? "text-emerald-600" : "text-red-600")}>
                        Réponse : {selectedOption?.text || "Non répondu"} 
                        {!isCorrect && <span className="text-slate-400 ml-2">(Correct : {correctOption?.text})</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
           </Card>

           {/* SCANS (Si présents) */}
           {submission.scans && submission.scans.length > 0 && (
             <div className="mb-8 space-y-4">
               <div className="flex items-center gap-3">
                 <Badge className="bg-blue-600 text-white uppercase px-3 py-1 font-black">Feuilles de composition</Badge>
                 <h4 className="font-black text-slate-900 uppercase">Documents numérisés</h4>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {submission.scans.map((scan: Scan) => (
                   <div key={scan.id} className="group relative overflow-hidden rounded-2xl border-4 border-white shadow-xl bg-slate-200 aspect-[3/4] transition-all hover:shadow-2xl">
                     <Image 
                       src={scan.url} 
                       alt={`Copie - Page ${scan.pageNumber}`} 
                       fill
                       className="object-cover transition-transform group-hover:scale-110"
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                       <p className="text-white font-black uppercase text-sm mb-1">Page {scan.pageNumber}</p>
                       <p className="text-slate-300 text-[10px] truncate mb-4">{scan.fileName}</p>
                       <a href={scan.url} target="_blank" rel="noopener noreferrer">
                         <Button variant="secondary" size="sm" className="w-full gap-2 font-bold uppercase tracking-wider h-10">
                           <Eye className="w-4 h-4" /> Agrandir
                         </Button>
                       </a>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* REPONSES OUVERTES & ÉTUDES DE CAS */}
           {submission.exam.parts.filter(p => p.type !== "QCM").map((part: ExamPart, pIdx: number) => {
             const partKey = part.type === "CASE_STUDY" ? "part3" : (part.order === 2 ? "part2" : null);
             const generalAnswer = partKey ? submission.answers[partKey] : null;
             
             return (
               <div key={part.id} className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-slate-800 text-white shadow-sm px-3 py-1 font-black">Partie {part.order || pIdx + 2}</Badge>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight">{part.title}</h4>
                  </div>
                  
                  {part.scenario && (
                    <Card className="p-6 bg-amber-50/50 border-amber-100/50 text-sm italic text-amber-900 shadow-sm rounded-2xl">
                      <p className="font-black mb-2 uppercase tracking-widest text-[10px] text-amber-600">Contexte / Scénario :</p>
                      <div className="whitespace-pre-wrap leading-relaxed">{part.scenario}</div>
                    </Card>
                  )}

                  {/* REPONSE GENERALE (Cas de l'étude de cas ou texte libre global) */}
                  {generalAnswer && (
                    <Card className="p-8 border-indigo-100 bg-indigo-50/10 shadow-sm rounded-3xl">
                      <div className="flex items-center gap-2 mb-4">
                         <PenTool className="w-4 h-4 text-indigo-500" />
                         <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">Réponse Générale / Développement :</p>
                      </div>
                      <div className="p-6 bg-white rounded-2xl text-slate-700 leading-relaxed border border-indigo-50 shadow-inner whitespace-pre-wrap font-serif text-lg">
                        {generalAnswer}
                      </div>
                    </Card>
                  )}

                  {/* QUESTIONS SPECIFIQUES */}
                  <div className="space-y-4">
                    {part.questions.map((question: { id: string; text: string }, qIdx: number) => {
                      const questionAnswer = submission.answers[question.id];
                      // Si la réponse est identique à la réponse générale, on ne la répète pas sauf si c'est la seule
                      const shouldShow = questionAnswer && questionAnswer !== generalAnswer;
                      
                      if (!shouldShow && !question.text) return null;

                      return (
                        <Card key={question.id} className="p-8 border-slate-100 shadow-sm space-y-4 rounded-3xl transition-all hover:shadow-md">
                          <div className="flex gap-4">
                            <span className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 font-black text-sm shadow-inner">
                              {qIdx + 1}
                            </span>
                            <p className="text-lg font-bold text-slate-800 leading-tight">{question.text}</p>
                          </div>
                          
                          {questionAnswer ? (
                            <div className="pl-14">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                 <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Réponse spécifique :
                               </p>
                               <div className="p-5 bg-slate-50 rounded-2xl text-slate-700 leading-relaxed border border-slate-100 whitespace-pre-wrap">
                                  {questionAnswer}
                               </div>
                            </div>
                          ) : !generalAnswer && (
                            <div className="pl-14 italic text-slate-400 text-sm">
                               Aucune réponse pour cette question.
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
               </div>
             );
           })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl max-w-[450px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-900 font-bold text-xl">
              <CheckCircle2 className={cn("w-6 h-6", submission.status === 'GRADED' ? "text-amber-600" : "text-emerald-600")} />
              {submission.status === 'GRADED' ? "Modifier la notation ?" : "Confirmer la notation ?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
                {submission.status === 'GRADED' 
                  ? `Vous allez mettre à jour la note globale à ${finalScoreOn20.toFixed(2)}/20. Les changements seront visibles immédiatement par le candidat.`
                  : `Vous êtes sur le point de valider la note globale de ${finalScoreOn20.toFixed(2)}/20. Une fois validée, le candidat pourra consulter son résultat et, s'il a réussi, son attestation sera générée.`
                }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel 
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setShowConfirm(false);
                handleSave();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 gap-2 px-6 border-none"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validation...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirmer et Envoyer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
