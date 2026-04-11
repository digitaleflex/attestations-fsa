"use client";

export const dynamic = 'force-dynamic';

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Download, FileText, TrendingUp, CheckCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import dynImport from "next/dynamic";
import TranscriptTemplate from "@/components/TranscriptTemplate";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const html2pdf = dynImport(() => import("html2pdf.js"), { ssr: false });

export default function TranscriptPage() {
  const [downloading, setDownloading] = useState(false);
  const [isReclamationOpen, setIsReclamationOpen] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [reclamationSubject, setReclamationSubject] = useState("");
  const [reclamationMessage, setReclamationMessage] = useState("");
  const queryClient = useQueryClient();

  const reclamationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/user/reclamations", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      setIsReclamationOpen(false);
      setReclamationSubject("");
      setReclamationMessage("");
      toast.success("Votre réclamation a été envoyée");
    },
  });

  const handleReclamationSubmit = () => {
    if (!selectedSubmissionId || !reclamationSubject || !reclamationMessage) return;
    reclamationMutation.mutate({
      submissionId: selectedSubmissionId,
      subject: reclamationSubject,
      message: reclamationMessage,
    });
  };

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
          margin: 10, // Small margin for page numbers/spacing
          filename: `Releve_Notes_${data.user.fullName.replace(/\s+/g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2, 
            useCORS: true, 
            letterRendering: true, 
            logging: false,
            width: 794 // Force A4 width DPI-equivalent
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
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

      {/* Exam Results Table & Mobile Cards */}
      <Card className="p-4 sm:p-6 bg-white shadow-sm overflow-hidden">
        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          Résultats détaillés
        </h3>

        {/* Version DESKTOP : Tableau */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 font-bold text-slate-700">Examen</th>
                <th className="text-center py-3 font-bold text-slate-700">Exam Note</th>
                <th className="text-center py-3 font-bold text-slate-700">Stage Note</th>
                <th className="text-center py-3 font-bold text-slate-700">Moyenne</th>
                <th className="text-center py-3 font-bold text-slate-700">Statut</th>
                <th className="text-center py-3 font-bold text-slate-700">Action</th>
                <th className="text-right py-3 font-bold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
                {data.examResults.map((exam: any, idx: number) => {
                  const examPct = Math.round((exam.score / exam.totalPoints) * 100);
                  const finalPct = exam.finalScore ? Math.round(exam.finalScore) : examPct;
                  const internshipPct = exam.internshipScore ? Math.round(exam.internshipScore) : null;
                  const passed = finalPct >= 65;
                  
                  return (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-medium text-slate-800">
                        <div className="flex flex-col">
                          <span className="font-bold">{exam.examName}</span>
                          {exam.type === 'MOCK' && (
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">Examen Blanc</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-center text-slate-600 font-bold">
                        {examPct}%
                      </td>
                      <td className="py-4 text-center text-slate-600">
                        {internshipPct !== null ? `${internshipPct}%` : "–"}
                      </td>
                      <td className="py-4 text-center font-black text-indigo-600">
                        {finalPct}%
                      </td>
                      <td className="py-4 text-center">
                        <Badge className={passed ? "bg-emerald-100 text-emerald-700 border-none px-3 py-1" : "bg-rose-100 text-rose-700 border-none px-3 py-1"}>
                          {passed ? "ADMIS" : "NON ADMIS"}
                        </Badge>
                      </td>
                      <td className="py-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSubmissionId(exam.id);
                            setReclamationSubject(`Contestation note - ${exam.examName}`);
                            setIsReclamationOpen(true);
                          }}
                          className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg gap-2"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Contester
                        </Button>
                      </td>
                    <td className="py-4 text-right text-slate-500 text-xs font-medium">
                      {new Date(exam.date).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Version MOBILE : Cartes */}
        <div className="md:hidden space-y-4">
          {data.examResults.map((exam: any, idx: number) => {
            const examPct = Math.round((exam.score / exam.totalPoints) * 100);
            const finalPct = exam.finalScore ? Math.round(exam.finalScore) : examPct;
            const internshipPct = exam.internshipScore ? Math.round(exam.internshipScore) : null;
            const passed = finalPct >= 65;

            return (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 leading-tight mb-1">{exam.examName}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{new Date(exam.date).toLocaleDateString("fr-FR")}</p>
                    {exam.type === 'MOCK' && (
                      <Badge variant="secondary" className="mt-2 text-[9px] font-black uppercase tracking-widest bg-white border-slate-200">Examen Blanc</Badge>
                    )}
                  </div>
                  <Badge className={passed ? "bg-emerald-100 text-emerald-700 border-none shrink-0" : "bg-rose-100 text-rose-700 border-none shrink-0"}>
                    {passed ? "ADMIS" : "NON ADMIS"}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-2 rounded-xl text-center shadow-sm">
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-tighter">Exam</p>
                    <p className="font-bold text-slate-700">{examPct}%</p>
                  </div>
                  <div className="bg-white p-2 rounded-xl text-center shadow-sm">
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-tighter">Stage</p>
                    <p className="font-bold text-slate-700">{internshipPct !== null ? `${internshipPct}%` : "–"}</p>
                  </div>
                  <div className="bg-blue-600 p-2 rounded-xl text-center shadow-lg shadow-blue-100">
                    <p className="text-[8px] text-blue-100 font-black uppercase tracking-tighter">Moyenne</p>
                    <p className="font-black text-white">{finalPct}%</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSubmissionId(exam.id);
                    setReclamationSubject(`Contestation note - ${exam.examName}`);
                    setIsReclamationOpen(true);
                  }}
                  className="w-full h-10 gap-2 font-bold text-xs text-slate-600 bg-white border-slate-200"
                >
                  <MessageSquare className="w-4 h-4" />
                  Contester ce résultat
                </Button>
              </div>
            );
          })}
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
                    {att.score ? ` • Score Global: ${Math.round(att.score)}/100` : ""}
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
      <div style={{ position: 'absolute', left: '-9999px', top: 0, visibility: 'hidden' }} aria-hidden="true">
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
              type: e.type
            })),
            attestations: data.attestations,
            globalAverage: data.stats.globalAverage,
            totalExams: data.stats.totalExams,
            passedExams: data.stats.passedExams,
            successRate: data.stats.successRate,
          }}
        />
      </div>

      {/* Reclamation Dialog */}
      <Dialog open={isReclamationOpen} onOpenChange={setIsReclamationOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-rose-500" />
              Soumettre une réclamation
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Expliquez pourquoi vous contestez votre résultat. L'administration examinera votre demande.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Sujet</Label>
              <Input
                id="subject"
                value={reclamationSubject}
                onChange={(e) => setReclamationSubject(e.target.value)}
                className="rounded-xl bg-slate-50 border-none h-12 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Votre message / Justification</Label>
              <Textarea
                id="message"
                placeholder="Détaillez votre demande ici..."
                className="rounded-2xl bg-slate-50 border-none min-h-[120px] font-medium"
                value={reclamationMessage}
                onChange={(e) => setReclamationMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsReclamationOpen(false)}
              className="rounded-xl font-bold border"
            >
              Annuler
            </Button>
            <Button
              onClick={handleReclamationSubmit}
              disabled={!reclamationMessage || reclamationMutation.isPending}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold gap-2 px-6 shadow-xl"
            >
              {reclamationMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
              Envoyer la réclamation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
