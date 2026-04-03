"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle, XCircle, Clock, ArrowLeft, 
  BookOpen, FileText, PenTool, Award,
  AlertCircle, History
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

export default function ResultDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: result, isLoading } = useQuery({
    queryKey: ["user-result", id],
    queryFn: () => apiFetch(`/api/user/results/${id}`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!result) return <div className="p-8 text-center">Résultat non trouvé</div>;

  const isGraded = result.status === "GRADED";
  const passed = result.totalScore >= (result.exam.passingScore / 100) * result.exam.totalPoints;
  const scorePercent = Math.round((result.totalScore / result.exam.totalPoints) * 100);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/results">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Détails de l'examen</h1>
            <p className="text-sm text-slate-500">{result.exam.name}</p>
          </div>
        </div>
        {!isGraded ? (
          <Badge className="px-4 py-1.5 text-sm bg-amber-100 text-amber-700 border border-amber-200">
            Correction en cours
          </Badge>
        ) : (
          <Badge className={`px-4 py-1.5 text-sm ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {passed ? "Succès" : "Échec"}
          </Badge>
        )}
      </div>

      {/* Résumé du Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white shadow-sm flex flex-col items-center justify-center border-b-4 border-b-blue-500">
          <p className="text-sm font-medium text-slate-500 mb-1">Score Global</p>
          <p className={`text-4xl font-bold ${!isGraded ? 'text-amber-600' : passed ? 'text-emerald-600' : 'text-rose-600'}`}>{scorePercent}%</p>
          <p className="text-xs text-slate-400 mt-1">{result.totalScore} / {result.exam.totalPoints} points</p>
        </Card>

        <Card className="p-6 bg-white shadow-sm flex flex-col items-center justify-center border-b-4 border-b-purple-500">
          <p className="text-sm font-medium text-slate-500 mb-1">Statut Correction</p>
          <div className="flex items-center gap-2">
            {result.status === "GRADED" ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span className="font-bold text-slate-800">Finalisé</span>
              </>
            ) : (
              <>
                <History className="w-5 h-5 text-amber-500 animate-pulse" />
                <span className="font-bold text-slate-800">En cours</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">{result.status === "GRADED" ? "Corrigé par l'administration" : "Attente de correction manuelle"}</p>
        </Card>

        <Card className="p-6 bg-white shadow-sm flex flex-col items-center justify-center border-b-4 border-b-emerald-500">
          <p className="text-sm font-medium text-slate-500 mb-1">Date de passage</p>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            <span className="font-bold text-slate-800">
              {new Date(result.submittedAt).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">À {new Date(result.submittedAt).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Détail des Parties */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            Performance par module
          </h2>

          <Card className="p-6 bg-white shadow-sm space-y-8">
            {/* Partie 1 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Partie 1 : QCM</h4>
                    <p className="text-xs text-slate-500">Vérification des connaissances théoriques</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-slate-800">{result.scorePart1}</span>
                  <span className="text-xs text-slate-400 ml-1">/ {result.exam.part1Points}</span>
                </div>
              </div>
              <Progress value={(result.scorePart1 / result.exam.part1Points) * 100} className="h-2 bg-slate-100" />
            </div>

            {/* Partie 2 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Partie 2 : Questions Ouvertes</h4>
                    <p className="text-xs text-slate-500">Capacité de réflexion et d'analyse</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-slate-800">{result.scorePart2}</span>
                  <span className="text-xs text-slate-400 ml-1">/ {result.exam.part2Points}</span>
                </div>
              </div>
              <Progress value={(result.scorePart2 / result.exam.part2Points) * 100} className="h-2 bg-slate-100" />
            </div>

            {/* Partie 3 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Partie 3 : Étude de Cas</h4>
                    <p className="text-xs text-slate-500">Mise en situation pratique</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-slate-800">{result.scorePart3}</span>
                  <span className="text-xs text-slate-400 ml-1">/ {result.exam.part3Points}</span>
                </div>
              </div>
              <Progress value={(result.scorePart3 / result.exam.part3Points) * 100} className="h-2 bg-slate-100" />
            </div>
          </Card>

          {/* Observations Administrateur */}
          {result.status === "GRADED" && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <AlertTitle className="text-blue-800 font-bold">Feedback de l'évaluateur</AlertTitle>
              <AlertDescription className="text-blue-700 mt-2 italic">
                "{result.observations || "Très bon travail dans l'ensemble. Les points théoriques sont maîtrisés, restez attentif aux détails lors de la mise en pratique."}"
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Recommandations */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Que faire maintenant ?
          </h2>

          <div className="space-y-4">
            {!isGraded ? (
              <Card className="p-6 bg-blue-50 border-blue-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Clock className="w-16 h-16 text-blue-900" />
                </div>
                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Correction en cours...
                </h4>
                <p className="text-sm text-blue-700 mb-4 leading-relaxed">
                  Votre examen a bien été reçu ! Les points de la <strong>Partie 1 (QCM)</strong> sont déjà visibles. 
                  L'administration doit maintenant corriger les <strong>Parties 2 et 3</strong> manuellement.
                </p>
                <div className="flex flex-col gap-2">
                  <div className="p-3 bg-white/50 rounded border border-blue-100 text-xs text-blue-600 italic">
                    Un statut définitif (Succès ou Échec) s'affichera une fois la correction terminée.
                  </div>
                  <Link href="/results">
                    <Button variant="outline" className="w-full mt-2 border-blue-200 text-blue-700 bg-white hover:bg-blue-50">
                      Retourner à la liste
                    </Button>
                  </Link>
                </div>
              </Card>
            ) : passed ? (
              <>
                <Card className="p-6 bg-emerald-50 border-emerald-100">
                  <h4 className="font-bold text-emerald-800 mb-2">Félicitations !</h4>
                  <p className="text-sm text-emerald-700 mb-4">
                    Vous avez brillamment réussi cet examen. Votre attestation est maintenant prête à être téléchargée.
                  </p>
                  <Link href="/attestations">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-md">
                      Voir mon attestation
                    </Button>
                  </Link>
                </Card>
                <Card className="p-6 bg-white border border-slate-100 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-2">Passer au niveau supérieur</h4>
                  <p className="text-sm text-slate-500 mb-4">
                    Pensez à faire une demande de stage pour mettre en pratique vos nouvelles compétences.
                  </p>
                  <Link href="/internships">
                    <Button variant="outline" className="w-full">
                      Postuler à un stage
                    </Button>
                  </Link>
                </Card>
              </>
            ) : (
              <>
                <Card className="p-6 bg-rose-50 border-rose-100">
                  <h4 className="font-bold text-rose-800 mb-2">Encouragements</h4>
                  <p className="text-sm text-rose-700 mb-4">
                    Le succès est un processus. Révisez les points où vous avez perdu des points et retentez l'examen dans 48h.
                  </p>
                  <Link href="/exams">
                    <Button variant="destructive" className="w-full">
                      Retourner aux examens
                    </Button>
                  </Link>
                </Card>
                <Card className="p-6 bg-white border border-slate-100 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-2">Besoin d'aide ?</h4>
                  <p className="text-sm text-slate-500 mb-4">
                    Contactez les instructeurs pour obtenir des éclaircissements sur certains modules.
                  </p>
                  <Button variant="outline" className="w-full">
                    Envoyer un message
                  </Button>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
