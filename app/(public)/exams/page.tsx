"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  ClipboardCheck, 
  Clock, 
  CheckCircle2, 
  Play, 
  AlertCircle 
} from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

type Exam = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  scheduledAt: string | null;
  hasSubmitted: boolean;
  totalPoints: number;
};

export default function CandidateExamsPage() {
  const { data: session, isPending } = useSession();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetch("/api/candidates/exams")
        .then(res => res.json())
        .then(data => {
          setExams(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (!isPending) {
      setLoading(false);
    }
  }, [session, isPending]);

  if (isPending || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-slate-500 font-medium">Récupération de vos examens...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-6 animate-in fade-in slide-in-from-bottom-5">
        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-800">Accès restreint</h1>
          <p className="text-slate-500">Connectez-vous à votre compte étudiant pour accéder aux examens.</p>
        </div>
        <Link href="/auth">
          <Button size="lg" className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700">Se connecter</Button>
        </Link>
      </div>
    );
  }

  const finishedCount = exams.filter(e => e.hasSubmitted).length;
  const availableCount = exams.length - finishedCount;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Mes Examens</h1>
          <p className="text-slate-500 font-medium italic">Accédez à vos sessions d'évaluation en ligne.</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 flex gap-2 py-1 px-3">
             <CheckCircle2 className="w-4 h-4" /> {finishedCount} Terminés
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 flex gap-2 py-1 px-3">
             <Clock className="w-4 h-4" /> {availableCount} Disponibles
          </Badge>
        </div>
      </div>

      <div className="grid gap-6">
        {exams.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-slate-50/30 flex flex-col items-center gap-4">
            <ClipboardCheck className="w-16 h-16 text-slate-300" />
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-500">Aucun examen disponible</p>
              <p className="text-sm text-slate-400">Revenez plus tard pour voir les nouvelles sessions.</p>
            </div>
          </Card>
        ) : (
          exams.map((exam) => (
            <Card key={exam.id} className="relative group overflow-hidden border-slate-100 hover:shadow-2xl hover:border-emerald-200 transition-all duration-500 transform hover:-translate-y-1">
              <div className="absolute top-0 left-0 w-2 h-full bg-slate-200 group-hover:bg-emerald-500 transition-colors" />
              <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-800">{exam.title}</h3>
                    {exam.hasSubmitted && (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Soumis ✓</Badge>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm line-clamp-2">{exam.description || "Aucune description fournie pour cet examen."}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 180 Minutes (Est.)</span>
                    <span className="flex items-center gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" /> {exam.totalPoints} Points</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center justify-end">
                  {exam.hasSubmitted ? (
                    <Link href={`/dashboard/results?examId=${exam.id}`}>
                      <Button variant="outline" className="h-11 px-6 border-slate-200 text-slate-600 hover:bg-slate-50">
                        Voir le résultat
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/exams/${exam.id}`}>
                      <Button className="h-11 px-8 gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 group/btn">
                        <Play className="w-4 h-4 fill-current group-hover/btn:scale-110 transition-transform" />
                        Démarrer
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
