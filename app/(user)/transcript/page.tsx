"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Download, FileText, TrendingUp, CheckCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import TranscriptTemplate from "@/components/TranscriptTemplate";
import { useState } from "react";

const html2pdf = dynamic(() => import("html2pdf.js"), { ssr: false });

export default function TranscriptPage() {
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["user-transcript"],
    queryFn: async () => {
      const res = await fetch("/api/user/transcript");
      if (!res.ok) throw new Error("Non autorisé");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleDownload = async () => {
    if (!data) return;

    setDownloading(true);
    toast.promise(
      (async () => {
        const html2pdfModule = await import("html2pdf.js");
        const html2pdfFn = html2pdfModule.default;

        const element = document.getElementById("transcript-content");
        if (!element) throw new Error("Template non trouvé");

        const opt = {
          margin: 10,
          filename: `Releve_Notes_${data.user.fullName.replace(/\s+/g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdfFn().set(opt).from(element).save();
      })(),
      {
        loading: 'Génération du relevé de notes...',
        success: 'Téléchargement réussi !',
        error: 'Erreur de génération',
      }
    );
    setDownloading(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="p-8 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-1/3 mb-4" />
          <div className="h-4 bg-slate-100 rounded w-1/2" />
        </Card>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-8 bg-slate-100 rounded w-3/4" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.examResults.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="p-12 text-center bg-white">
          <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">Aucun résultat disponible</h2>
          <p className="text-slate-500">
            Votre relevé de notes sera disponible après avoir passé au moins un examen.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <Card className="p-8 bg-gradient-to-br from-blue-900 to-slate-900 text-white shadow-2xl relative overflow-hidden border-none">
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-none px-3 py-1 text-[10px] uppercase font-black tracking-widest mb-2">
              Document officiel
            </Badge>
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-emerald-400" />
              <h2 className="text-3xl font-black tracking-tighter">Relevé de Notes</h2>
            </div>
            <p className="text-blue-100/70 font-medium">
              Votre parcours académique complet à la Ferme Saint André
            </p>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/20 rounded-xl px-6 font-bold gap-2"
          >
            {downloading ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Télécharger (PDF)
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Examens passés</p>
          <p className="text-2xl font-black text-slate-800">{data.stats.totalExams}</p>
        </Card>
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Réussis</p>
          <p className="text-2xl font-black text-emerald-600">{data.stats.passedExams}</p>
        </Card>
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taux de réussite</p>
          <p className="text-2xl font-black text-amber-600">{data.stats.successRate}%</p>
        </Card>
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Moyenne</p>
          <p className="text-2xl font-black text-purple-600">{data.stats.globalAverage}/100</p>
        </Card>
      </div>

      {/* Exam Results Table */}
      <Card className="p-6 bg-white shadow-sm">
        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          Résultats détaillés
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 font-bold text-slate-700">Examen</th>
                <th className="text-center py-3 font-bold text-slate-700">Score</th>
                <th className="text-center py-3 font-bold text-slate-700">Partie 1</th>
                <th className="text-center py-3 font-bold text-slate-700">Partie 2</th>
                <th className="text-center py-3 font-bold text-slate-700">Partie 3</th>
                <th className="text-center py-3 font-bold text-slate-700">Statut</th>
                <th className="text-right py-3 font-bold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.examResults.map((exam: any, idx: number) => {
                const percentage = Math.round((exam.score / exam.totalPoints) * 100);
                const passed = percentage >= 60;
                return (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 font-medium text-slate-800">{exam.examName}</td>
                    <td className="py-3 text-center font-bold" style={{ color: passed ? "#059669" : "#dc2626" }}>
                      {percentage}%
                    </td>
                    <td className="py-3 text-center text-slate-600">{exam.part1Score ?? "-"}</td>
                    <td className="py-3 text-center text-slate-600">{exam.part2Score ?? "-"}</td>
                    <td className="py-3 text-center text-slate-600">{exam.part3Score ?? "-"}</td>
                    <td className="py-3 text-center">
                      <Badge className={passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                        {passed ? "ADMIS" : "NON ADMIS"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-slate-600">
                      {new Date(exam.date).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Attestations */}
      {data.attestations.length > 0 && (
        <Card className="p-6 bg-white shadow-sm">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-500" />
            Attestations obtenues ({data.attestations.length})
          </h3>
          <div className="space-y-3">
            {data.attestations.map((att: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="font-bold text-slate-800">{att.formationName}</p>
                  <p className="text-xs text-slate-500">
                    {att.type === "FORMATION" ? "Formation" : att.type === "STAGE" ? "Stage" : "Certification"}
                    {att.score ? ` • Score: ${att.score}/100` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-bold text-slate-600">{att.code}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(att.issuedAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Hidden Template for PDF */}
      <div className="hidden" aria-hidden="true">
        <TranscriptTemplate
          id="transcript-content"
          data={{
            fullName: data.user.fullName,
            birthDate: data.user.birthDate,
            birthPlace: data.user.birthPlace,
            email: data.user.email,
            examResults: data.examResults.map((e: any) => ({
              ...e,
              score: Math.round((e.score / e.totalPoints) * 100),
              totalPoints: 100,
            })),
            attestations: data.attestations,
            globalAverage: data.stats.globalAverage,
            totalExams: data.stats.totalExams,
            passedExams: data.stats.passedExams,
            successRate: data.stats.successRate,
          }}
        />
      </div>
    </div>
  );
}
