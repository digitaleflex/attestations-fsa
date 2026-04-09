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
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
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
  answers: any;
  submittedAt: string;
  scans: any[];
  candidate: { name: string, email: string };
  exam: {
    title: string;
    parts: any[];
    part1Points: number;
    part2Points: number;
    part3Points: number;
    totalPoints: number;
  }
};

export default function GradeSubmissionPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [score2, setScore2] = useState<number>(0);
  const [score3, setScore3] = useState<number>(0);
  const [internshipScore, setInternshipScore] = useState<number>(10); // Par défaut 10/20
  const [obs, setObs] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch(`/api/submissions/${id}`) // Assuming a GET route exists or we use the submission API
      .then(res => res.json())
      .then(data => {
        setSubmission(data);
        setScore2(data.scorePart2 || 0);
        setScore3(data.scorePart3 || 0);
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
          part2Score: parseFloat(score2.toString()),
          part3Score: parseFloat(score3.toString()),
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

  const totalRaw = submission.scorePart1 + score2 + score3;
  const maxTotal = submission.exam.totalPoints || 100;
  
  const examScoreOn20 = (totalRaw / maxTotal) * 20;
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
                <label className="text-xs font-bold uppercase text-slate-400">Partie 2 (Max {submission.exam.part2Points || 40})</label>
                <Input 
                  type="number" 
                  max={submission.exam.part2Points || 40}
                  step="0.5"
                  className="bg-slate-800 border-slate-700 text-white text-lg h-12"
                  value={score2}
                  onChange={(e) => setScore2(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400">Partie 3 (Max {submission.exam.part3Points || 40})</label>
                <Input 
                  type="number" 
                  max={submission.exam.part3Points || 40}
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
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500 text-white">Partie 1</Badge>
                  <h4 className="font-black text-slate-900 uppercase">Correction Automatique (QCM)</h4>
                </div>
                <p className="text-2xl font-black text-emerald-600">{submission.scorePart1} <span className="text-sm text-slate-400">/ {submission.exam.part1Points || 20}</span></p>
              </div>
              <p className="text-sm text-slate-500 italic">Cette partie a été notée par le système lors de la soumission candidate.</p>
           </Card>

           {/* SCANS (Si présents) */}
           {submission.scans && submission.scans.length > 0 && (
             <div className="mb-8 space-y-4">
               <div className="flex items-center gap-3">
                 <Badge className="bg-blue-600 text-white uppercase px-3 py-1 font-black">Feuilles de composition</Badge>
                 <h4 className="font-black text-slate-900 uppercase">Documents numérisés</h4>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {submission.scans.map((scan: any) => (
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

           {/* REPONSES OUVERTES */}
           {submission.exam.parts.filter(p => p.type !== "QCM").map((part: any, pIdx: number) => (
             <div key={part.id} className="space-y-6">
                <div className="flex items-center gap-3">
                  <Badge className="bg-slate-800 text-white">Partie {pIdx + 2}</Badge>
                  <h4 className="font-black text-slate-900 uppercase">{part.title}</h4>
                </div>
                
                {part.scenario && (
                  <Card className="p-6 bg-amber-50 border-amber-100 text-sm italic text-amber-900 shadow-inner">
                    <p className="font-black mb-2 uppercase tracking-widest text-[10px]">Scénario d'examen :</p>
                    {part.scenario}
                  </Card>
                )}

                {part.questions.map((question: any, qIdx: number) => (
                  <Card key={question.id} className="p-8 border-slate-100 shadow-sm space-y-4">
                    <div className="flex gap-4">
                      <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 font-bold text-sm">
                        {qIdx + 1}
                      </span>
                      <p className="text-lg font-bold text-slate-800">{question.text}</p>
                    </div>
                    <div className="pl-12">
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Réponse du candidat :</p>
                       <div className="p-4 bg-slate-50 rounded-xl text-slate-700 leading-relaxed border border-slate-100 whitespace-pre-wrap">
                          {submission.answers[question.id] || "Aucune réponse fournie."}
                       </div>
                    </div>
                  </Card>
                ))}
             </div>
           ))}
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
