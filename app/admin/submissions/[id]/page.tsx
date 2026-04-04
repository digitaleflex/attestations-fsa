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
  const finalScore = (totalRaw / maxTotal) * 20; // Toujours sur 20 pour l'affichage standard

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/submissions">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Correction de Copie</h1>
            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">ID: {submission.id}</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Note Finale Estimée</p>
            <p className="text-3xl font-black text-emerald-600">{finalScore.toFixed(2)} <span className="text-sm text-slate-300">/ 20</span></p>
          </div>
          <Button 
            disabled={isSaving} 
            onClick={() => setShowConfirm(true)} 
            size="lg" 
            className="bg-slate-900 hover:bg-slate-800 gap-2 h-12 px-8 shadow-xl hover:shadow-2xl transition-all"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4" />}
            Valider la note
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
                     <img 
                       src={scan.url} 
                       alt={`Copie - Page ${scan.pageNumber}`} 
                       className="w-full h-full object-cover transition-transform group-hover:scale-110"
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
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              Confirmer la notation ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
                Vous êtes sur le point de valider la note de <span className="font-bold text-slate-900">{finalScore.toFixed(2)}/20</span>. 
                Une fois validée, le candidat pourra consulter son résultat et, s'il a réussi, son attestation sera générée.
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
