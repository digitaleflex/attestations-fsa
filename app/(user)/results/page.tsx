"use client";

export const dynamic = 'force-dynamic';

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, BarChart3, ChevronRight, Clock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SkeletonCard, SkeletonStats } from "@/components/SkeletonLoader";
import { apiFetch } from "@/lib/api-client";
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
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export default function UserResultsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isReclamationOpen, setIsReclamationOpen] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [reclamationSubject, setReclamationSubject] = useState("");
  const [reclamationMessage, setReclamationMessage] = useState("");

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
    queryKey: ["user-results"],
    queryFn: () => apiFetch("/api/user/results") as any,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <SkeletonStats />
        <Card className="p-4 bg-white animate-pulse h-16" />
        <div className="grid grid-cols-1 gap-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-white shadow-sm">
          <p className="text-sm text-slate-500">Total examens</p>
          <p className="text-2xl font-bold text-slate-800">{data?.stats?.totalExams || 0}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-sm text-slate-500">Réussis</p>
          <p className="text-2xl font-bold text-emerald-600">{data?.stats?.passedExams || 0}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-rose-500">
          <p className="text-sm text-slate-500">Échoués</p>
          <p className="text-2xl font-bold text-rose-600">{data?.stats?.failedExams || 0}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
          <p className="text-sm text-slate-500">Score moyen</p>
          <p className="text-2xl font-bold text-blue-600">{data?.stats?.averageScore || 0}%</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-l-4 border-l-purple-500">
          <p className="text-sm text-slate-500">Meilleur score</p>
          <p className="text-2xl font-bold text-purple-600">{data?.stats?.bestScore || 0}%</p>
        </Card>
      </div>

      {!data?.results || data.results.length === 0 ? (
        <Card className="p-12 bg-white shadow-sm">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-600">Aucun résultat</p>
            <p className="text-sm text-slate-500 mt-1">
              Passez des examens pour voir vos résultats ici
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {data.results.map((result: any) => (
            <Card key={result.id} className="p-6 bg-white shadow-sm">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${result.passed ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                      {result.passed ? (
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <XCircle className="w-6 h-6 text-rose-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-slate-800">{result.examName}</h3>
                        <Badge variant="outline" className={result.type === 'MOCK' ? "border-indigo-200 text-indigo-600 bg-indigo-50" : "border-blue-200 text-blue-600 bg-blue-50"}>
                          {result.type === 'MOCK' ? "BLANC" : "OFFICIEL"}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {result.completedAt ? new Date(result.completedAt).toLocaleDateString("fr-FR") : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {result.status === 'PENDING_REVIEW' ? (
                      <div className="flex flex-col items-end">
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1.5 py-1">
                          <Clock className="w-3.5 h-3.5" />
                          Correction en cours
                        </Badge>
                        <p className="text-[10px] text-slate-400 mt-1">Questions ouvertes à corriger</p>
                      </div>
                    ) : (
                      <>
                        <p className={`text-3xl font-bold ${result.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {result.scorePercent}%
                        </p>
                        <p className="text-xs text-slate-500">
                          {result.totalScore}/{result.maxScore} points
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">Aperçu rapide</p>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400">Partie 1 (QCM)</p>
                        <p className="text-sm font-bold text-slate-700">{result.scorePart1}/{result.maxPart1 || 20}</p>
                      </div>
                      <div className="border-l border-slate-100 pl-4">
                        <p className="text-[10px] text-slate-400">Partie 2 & 3</p>
                        {result.status === 'PENDING_REVIEW' ? (
                          <p className="text-sm font-bold text-amber-500 animate-pulse italic">À corriger</p>
                        ) : (
                          <p className="text-sm font-bold text-slate-700">{(result.scorePart2 || 0) + (result.scorePart3 || 0)}/{(result.maxPart2 || 40) + (result.maxPart3 || 40)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedSubmissionId(result.id);
                        setReclamationSubject(`Contestation note - ${result.examName}`);
                        setIsReclamationOpen(true);
                      }}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Contester
                    </Button>
                    <Link href={`/results/${result.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        onMouseEnter={() => {
                          queryClient.prefetchQuery({
                            queryKey: ["user-result", result.id],
                            queryFn: async () => {
                              const res = await fetch(`/api/user/results/${result.id}`);
                              if (!res.ok) throw new Error("Erreur");
                              return res.json();
                            },
                            staleTime: 5 * 60 * 1000,
                          });
                        }}
                        className="bg-slate-50 hover:bg-white border-slate-200 text-slate-600 hover:text-emerald-600 font-semibold group transition-all"
                      >
                        Voir le détail
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

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
