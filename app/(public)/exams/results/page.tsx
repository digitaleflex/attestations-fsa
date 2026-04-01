"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  Download, 
  Award,
  ChevronLeft,
  FileText,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

type Submission = {
  id: string;
  examId: string;
  status: string; // PENDING, GRADED
  scorePart1: number;
  scorePart2: number;
  scorePart3: number;
  totalScore: number;
  submittedAt: string;
  exam: {
    title: string;
    parts: { title: string, points: number }[];
  }
};

function ResultsContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("examId");
  const router = useRouter();
  const { data: session } = useSession();
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session && examId) {
      fetch(`/api/submissions/my-result?examId=${examId}`)
        .then(res => res.json())
        .then(data => {
          setSubmission(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [examId, session]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-slate-500 font-medium">Récupération de vos résultats...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <Card className="max-w-md mx-auto p-12 text-center space-y-6">
        <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800">Résultat indisponible</h2>
          <p className="text-slate-500">Aucune soumission trouvée pour cet examen.</p>
        </div>
        <Link href="/exams">
          <Button variant="outline">Retour aux examens</Button>
        </Link>
      </Card>
    );
  }

  const isGraded = submission.status === "GRADED";
  const isSuccess = submission.totalScore >= 12;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/exams">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Détail du Résultat</h1>
          <p className="text-slate-500">{submission.exam.title}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* SCORE FINAL CARD */}
        <Card className={`md:col-span-2 p-8 relative overflow-hidden flex flex-col items-center justify-center text-center space-y-4 ${
          isGraded ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white" : "bg-white"
        }`}>
          {!isGraded && (
            <div className="absolute top-4 right-4 animate-pulse">
               <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 flex gap-1.5">
                 <Clock className="w-3.5 h-3.5" /> Correction en cours
               </Badge>
            </div>
          )}
          
          <div className="space-y-2">
            <p className={`text-sm font-black uppercase tracking-[0.2em] ${isGraded ? "text-emerald-400" : "text-slate-400"}`}>
              {isGraded ? "Note Finale" : "Status de l'examen"}
            </p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-8xl font-black">
                {isGraded ? submission.totalScore : "⏳"}
              </span>
              <span className={`text-2xl font-bold ${isGraded ? "text-slate-400" : "text-slate-300"}`}>/ 20</span>
            </div>
          </div>
          
          {isGraded && (
            <div className="pt-4">
               {isSuccess ? (
                 <div className="flex flex-col items-center gap-3">
                   <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                     <Award className="w-5 h-5" />
                     <span className="font-bold">Félicitations ! Vous avez réussi.</span>
                   </div>
                   <Link href="/verifier" target="_blank">
                    <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-14 px-8 gap-3 shadow-xl shadow-emerald-900/40">
                      <Download className="w-5 h-5" />
                      Télécharger mon Attestation
                    </Button>
                   </Link>
                 </div>
               ) : (
                 <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 px-6 py-2 text-base">
                   Ajourné (Seuil de réussite : 12/20)
                 </Badge>
               )}
            </div>
          )}

          {!isGraded && (
            <p className="text-slate-500 max-w-sm">
              Votre partie QCM est validée. Un formateur corrige actuellement vos réponses ouvertes et votre étude de cas.
            </p>
          )}
        </Card>

        {/* INFO CARD */}
        <Card className="p-6 bg-slate-50/50 border-slate-100 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date de soumission</p>
              <p className="text-slate-700 font-medium">
                {new Date(submission.submittedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID Session</p>
              <p className="text-slate-700 font-mono text-xs">{submission.id}</p>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-200/60 mt-6">
            <p className="text-sm text-slate-500 italic flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Réponses enregistrées
            </p>
          </div>
        </Card>
      </div>

      {/* DETAIL PAR PARTIE */}
      <h3 className="text-xl font-bold text-slate-900 pt-4">Détails de l'évaluation sur 100 points</h3>
      <div className="grid gap-4">
        {/* PARTIE 1 */}
        <Card className="p-6 border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full" />
                <p className="font-bold text-slate-800">Partie 1 : QCM</p>
              </div>
              <p className="text-sm text-slate-400">Correction instantanée par le système</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-blue-600">{submission.scorePart1} <span className="text-sm text-slate-300">/ 20</span></p>
            </div>
          </div>
        </Card>

        {/* PARTIE 2 */}
        <Card className="p-6 border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isGraded ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`} />
                <p className="font-bold text-slate-800">Partie 2 : Questions Ouvertes</p>
              </div>
              <p className="text-sm text-slate-400">Évaluation de la compréhension théorique</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-black ${isGraded ? "text-emerald-600" : "text-slate-300"}`}>
                {isGraded ? submission.scorePart2 : "--"} <span className="text-sm text-slate-300">/ 40</span>
              </p>
            </div>
          </div>
        </Card>

        {/* PARTIE 3 */}
        <Card className="p-6 border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isGraded ? "bg-indigo-500" : "bg-amber-400 animate-pulse"}`} />
                <p className="font-bold text-slate-800">Partie 3 : Étude de Cas / Pratique</p>
              </div>
              <p className="text-sm text-slate-400">Mise en situation professionnelle</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-black ${isGraded ? "text-indigo-600" : "text-slate-300"}`}>
                {isGraded ? submission.scorePart3 : "--"} <span className="text-sm text-slate-300">/ 40</span>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function ExamResultsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-10 h-10 animate-spin text-emerald-600" /></div>}>
      <ResultsContent />
    </Suspense>
  );
}
