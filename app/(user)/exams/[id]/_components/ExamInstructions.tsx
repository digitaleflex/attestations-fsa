"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Clock, AlertCircle, CheckCircle, BookOpen, Save, ShieldCheck } from "lucide-react";
import type { ExamData } from "./types";

interface ExamInstructionsProps {
  exam: ExamData;
  agreedToRules: boolean;
  onAgreedChange: (agreed: boolean) => void;
  onStart: () => void;
}

export function ExamInstructions({ exam, agreedToRules, onAgreedChange, onStart }: ExamInstructionsProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="p-8 bg-white shadow-lg">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">{exam.name}</h1>
            <p className="text-slate-600">{exam.description}</p>
          </div>

          <div className="space-y-6 mb-8">
            <Alert className="bg-blue-50 border-blue-200">
              <Clock className="w-5 h-5 text-blue-600" />
              <AlertTitle className="text-blue-800">Durée de l'examen</AlertTitle>
              <AlertDescription className="text-blue-700">
                {exam.duration ? `${Math.round(exam.duration / 60)} minutes` : "60 minutes"}{" "}
                pour compléter toutes les parties.
              </AlertDescription>
            </Alert>

            <Alert className="bg-emerald-50 border-emerald-200">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <AlertTitle className="text-emerald-800">Barème de notation</AlertTitle>
              <AlertDescription className="text-emerald-700">
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {exam.part1Enabled && (
                    <li><strong>Partie 1 (QCM)</strong> : {exam.part1Points} points - Correction automatique</li>
                  )}
                  {exam.part2Enabled && (
                    <li><strong>Partie 2 (Questions ouvertes)</strong> : {exam.part2Points} points - Correction par l'admin</li>
                  )}
                  {exam.part3Enabled && (
                    <li><strong>Partie 3 (Étude de cas)</strong> : {exam.part3Points} points - Correction par l'admin</li>
                  )}
                </ul>
                <p className="mt-3 font-semibold">
                  🎯 Note minimale requise :{" "}
                  <span className="text-emerald-700 font-bold">
                    {exam.passingScore || 65}% soit {Math.round(((exam.passingScore || 65) / 100) * 20)}/20
                  </span>{" "}
                  pour obtenir l'attestation
                </p>
              </AlertDescription>
            </Alert>

            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <AlertTitle className="text-amber-800">⚠️ Important - Partie 3 : Étude de cas</AlertTitle>
              <AlertDescription className="text-amber-700">
                <div className="space-y-2 mt-2 text-sm">
                  <p><strong>📋 Déroulement :</strong></p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Vous découvrirez d'abord le <strong>sujet de l'étude de cas</strong></li>
                    <li>Vous devrez rédiger vos réponses directement dans la zone de texte</li>
                    <li>
                      <strong>🔍 Visibilité Admin :</strong> Les administrateurs pourront voir vos réponses
                      lors de la correction. Soyez clair et structuré.
                    </li>
                    <li>
                      <strong>📝 Conseils :</strong>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li>Structurez votre réponse (introduction, développement, conclusion)</li>
                        <li>Justifiez vos choix et raisonnements</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>

            <Alert className="bg-purple-50 border-purple-200">
              <Save className="w-5 h-5 text-purple-600" />
              <AlertTitle className="text-purple-800">Sauvegarde automatique</AlertTitle>
              <AlertDescription className="text-purple-700">
                Vos réponses sont sauvegardées automatiquement. En cas de problème technique,
                vous pourrez reprendre où vous vous êtes arrêté.
              </AlertDescription>
            </Alert>

            <Alert className="bg-indigo-50 border-indigo-200">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <AlertTitle className="text-indigo-800 font-bold uppercase tracking-wider">
                🔒 CHARTE D&apos;INTÉGRITÉ ACADÉMIQUE - SESSION MOBILE
              </AlertTitle>
              <AlertDescription className="text-indigo-700">
                <div className="space-y-4 mt-3">
                  <p className="font-bold underline decoration-indigo-300 text-sm">
                    Précautions obligatoires pour composer sur Smartphone :
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 list-none mt-2">
                    {([
                      { strong: 'Mode "Ne pas déranger"', rest: " vivement conseillé" },
                      { strong: "Interdiction de changer", rest: " d'application" },
                      { strong: "Batterie chargée", rest: " (minimum 50%)" },
                      { strong: "Appui externe interdit", rest: " (IA, Recherche Google)" },
                    ] as const).map((rule, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] shrink-0 font-bold">
                          {idx + 1}
                        </span>
                        <span><strong>{rule.strong}</strong>{rule.rest}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="p-4 bg-white/60 rounded-2xl border border-indigo-200 text-[11px] leading-relaxed">
                    <p className="mb-2">
                      📱 <strong>AVIS AUX CANDIDATS SUR MOBILE :</strong> Votre navigation est surveillée.
                      Un changement d&apos;onglet ou de fenêtre peut être détecté comme une tentative de fraude.
                    </p>
                    <p>Tout événement suspect est enregistré nominativement. Restez concentré jusqu&apos;à la fin.</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 py-8 border-t border-slate-100">
            <label className="flex items-start gap-3 cursor-pointer group max-w-lg px-4">
              <input
                type="checkbox"
                checked={agreedToRules}
                onChange={(e) => onAgreedChange(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 transition-all cursor-pointer"
              />
              <span className="text-sm font-bold text-slate-700 group-hover:text-red-700 transition-colors">
                Je déclare avoir lu les règles et je m&apos;engage sur l&apos;honneur à respecter la charte
                d&apos;intégrité de la FSA.
              </span>
            </label>

            <Button
              onClick={onStart}
              size="lg"
              disabled={!agreedToRules}
              className={cn(
                "gap-3 px-12 h-14 text-lg font-black rounded-2xl transition-all duration-300 tracking-tighter",
                agreedToRules
                  ? "bg-gradient-to-r from-red-600 to-rose-600 hover:scale-105 active:scale-95 shadow-xl shadow-red-200 text-white"
                  : "bg-slate-200 text-slate-400 grayscale cursor-not-allowed",
              )}
            >
              <CheckCircle className="w-6 h-6" />
              DÉMARRER MON EXAMEN
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
