"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  ChevronLeft, 
  Award, 
  Save,
  AlertCircle,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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
  user: { name: string, email: string };
  exam: {
    title: string;
    parts: any[];
  }
};

export default function GradeSubmissionPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [score2, setScore2] = useState<number>(0);
  const [score3, setScore3] = useState<number>(0);
  const [obs, setObs] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    if (score2 > 40 || score3 > 40) {
      toast.error("Le score max par partie est de 40 points.");
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/submissions/${id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scorePart2: parseFloat(score2.toString()),
          scorePart3: parseFloat(score3.toString()),
          observations: obs
        })
      });

      if (!res.ok) throw new Error("Erreur de sauvegarde");
      
      toast.success("Notation enregistrée !");
      router.push("/admin/submissions");
    } catch (err) {
      toast.error("Échec de l'enregistrement de la note.");
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
  const finalScore = totalRaw / 5;

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
            onClick={handleSave} 
            size="lg" 
            className="bg-slate-900 hover:bg-slate-800 gap-2 h-12 px-8"
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
                <p className="text-slate-800 font-medium">{submission.user.name}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Email</p>
                <p className="text-slate-800">{submission.user.email}</p>
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
                <label className="text-xs font-bold uppercase text-slate-400">Partie 2 (Max 40)</label>
                <Input 
                  type="number" 
                  max={40}
                  step="0.5"
                  className="bg-slate-800 border-slate-700 text-white text-lg h-12"
                  value={score2}
                  onChange={(e) => setScore2(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400">Partie 3 (Max 40)</label>
                <Input 
                  type="number" 
                  max={40}
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
                <p className="text-2xl font-black text-emerald-600">{submission.scorePart1} <span className="text-sm text-slate-400">/ 20</span></p>
              </div>
              <p className="text-sm text-slate-500 italic">Cette partie a été notée par le système lors de la soumission candidate.</p>
           </Card>

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
    </div>
  );
}
