"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  FileEdit,
  Sparkles,
  RefreshCw 
} from "lucide-react";
import { toast } from "sonner";

type Submission = {
  id: string;
  exam: { title: string };
  status: string;
  scorePart1: number;
  scorePart2: number;
  scorePart3: number;
  totalScore: number;
  submittedAt: string;
};

export function UserExamResults({ userId }: { userId: string }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradingData, setGradingData] = useState({ p1: 0, p2: 0, p3: 0 });
  const [isAutoGrading, setIsAutoGrading] = useState(false);

  useEffect(() => {
    fetch(`/api/submissions?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        setSubmissions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const handleStartGrading = (s: Submission) => {
    setGradingId(s.id);
    setGradingData({ p1: s.scorePart1, p2: s.scorePart2, p3: s.scorePart3 });
  };

  const handleAutoGrade = async (id: string) => {
    setIsAutoGrading(true);
    try {
      const res = await fetch(`/api/submissions/${id}/grade`, { method: "POST" });
      if (!res.ok) throw new Error("Erreur");
      const { autoScoreP1 } = await res.json();
      setGradingData(prev => ({ ...prev, p1: autoScoreP1 }));
      toast.success(`Score QCM calculé : ${autoScoreP1}/20`);
    } catch {
      toast.error("Échec du calcul automatique");
    } finally {
      setIsAutoGrading(false);
    }
  };

  const handleSaveGrade = async (id: string) => {
    try {
      const res = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          scorePart1: gradingData.p1,
          scorePart2: gradingData.p2,
          scorePart3: gradingData.p3,
          status: "GRADED",
          gradedBy: "Admin"
        })
      });

      if (!res.ok) throw new Error("Erreur");
      
      toast.success("Notes enregistrées !");
      setGradingId(null);
      // Refresh
      const updated = submissions.map(s => s.id === id ? { 
        ...s, 
        scorePart1: gradingData.p1, 
        scorePart2: gradingData.p2, 
        scorePart3: gradingData.p3,
        totalScore: gradingData.p1 + gradingData.p2 + gradingData.p3,
        status: "GRADED"
      } : s);
      setSubmissions(updated);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-300" />;

  if (submissions.length === 0) {
    return <p className="text-center py-4 text-slate-400 text-sm italic">Aucun examen passé pour le moment.</p>;
  }

  return (
    <div className="space-y-4 pt-4 border-t mt-4">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        Résultats des Examens
      </h3>
      <div className="grid gap-4">
        {submissions.map((s) => (
          <Card key={s.id} className="p-4 bg-slate-50 border-slate-100 relative overflow-hidden group">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{s.exam.title}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">Soumis le {new Date(s.submittedAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <Badge className={s.status === 'GRADED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                  {s.status === 'GRADED' ? 'Noté' : 'En attente'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Partie 1 (QCM)</p>
                  {gradingId === s.id ? (
                    <div className="space-y-1">
                      <Input 
                        type="number" 
                        value={gradingData.p1} 
                        onChange={(e) => setGradingData({...gradingData, p1: parseFloat(e.target.value) || 0})}
                        className="h-7 text-center font-bold text-sm mt-1"
                      />
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-full text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                        onClick={() => handleAutoGrade(s.id)}
                        disabled={isAutoGrading}
                      >
                         {isAutoGrading ? <RefreshCw className="w-2 h-2 animate-spin" /> : <Sparkles className="w-2 h-2" />}
                         Calcule QCM
                      </Button>
                    </div>
                  ) : (
                    <p className="font-bold text-slate-700">{s.scorePart1}/20</p>
                  )}
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Partie 2 (Ouverte)</p>
                  {gradingId === s.id ? (
                    <Input 
                      type="number" 
                      value={gradingData.p2} 
                      onChange={(e) => setGradingData({...gradingData, p2: parseFloat(e.target.value) || 0})}
                      className="h-7 text-center font-bold text-sm mt-1"
                    />
                  ) : (
                    <p className="font-bold text-slate-700">{s.scorePart2}/40</p>
                  )}
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Partie 3 (Cas)</p>
                  {gradingId === s.id ? (
                    <Input 
                      type="number" 
                      value={gradingData.p3} 
                      onChange={(e) => setGradingData({...gradingData, p3: parseFloat(e.target.value) || 0})}
                      className="h-7 text-center font-bold text-sm mt-1"
                    />
                  ) : (
                    <p className="font-bold text-slate-700">{s.scorePart3}/40</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3 bg-slate-50 group-hover:bg-slate-100 transition-colors">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-slate-400 font-bold">TOTAL:</span>
                  <span className="text-lg font-black text-primary">{gradingId === s.id ? (gradingData.p1 + gradingData.p2 + gradingData.p3) : s.totalScore}/100</span>
                </div>
                {gradingId === s.id ? (
                  <Button size="sm" className="h-8 gap-2" onClick={() => handleSaveGrade(s.id)}>
                    <Save className="w-3 h-3" /> Enregistrer
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8 gap-2 bg-white" onClick={() => handleStartGrading(s)}>
                    <FileEdit className="w-3 h-3" /> Noter
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
