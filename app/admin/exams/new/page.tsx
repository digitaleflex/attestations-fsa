"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, X, Save, Clock, BookOpen, FileText, PenTool, 
  AlertCircle, CheckCircle, Settings, BarChart3
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function CreateExamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Exam settings
  const [exam, setExam] = useState({
    name: "",
    description: "",
    formationId: "",
    duration: 3600, // seconds
    passingScore: 60, // percentage
    part1Enabled: true,
    part1Questions: 20,
    part1Points: 20,
    part2Enabled: true,
    part2Questions: 5,
    part2Points: 40,
    part3Enabled: true,
    part3Subject: "",
    part3Points: 40,
    part3Mode: "digital", // "digital" or "physical"
    randomizeQuestions: false,
    showResults: false,
  });

  const handleChange = (field: string, value: any) => {
    setExam((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!exam.name) {
      toast.error("Le nom de l'examen est requis");
      return;
    }
    if (!exam.formationId) {
      toast.error("La formation est requise");
      return;
    }
    if (!exam.part1Enabled && !exam.part2Enabled && !exam.part3Enabled) {
      toast.error("Au moins une partie doit être activée");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exam),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur");
      }

      toast.success("✅ Examen créé avec succès !");
      router.push("/admin/exams");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  const totalPoints = (exam.part1Enabled ? exam.part1Points : 0) +
                      (exam.part2Enabled ? exam.part2Points : 0) +
                      (exam.part3Enabled ? exam.part3Points : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Créer un Examen</h1>
              <p className="text-xs text-slate-500">Configurez tous les paramètres</p>
            </div>
          </div>
          <Link href="/admin/exams">
            <Button variant="outline" size="sm">← Retour</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Info */}
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-slate-800">Informations générales</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                  Nom de l'examen *
                </Label>
                <Input
                  id="name"
                  value={exam.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Ex: Examen Certification Aquaculture"
                  className="mt-1.5 h-11"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="description" className="text-sm font-semibold text-slate-700">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={exam.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Décrivez l'examen, les prérequis, les objectifs..."
                  rows={3}
                  className="mt-1.5 resize-none"
                />
              </div>

              <div>
                <Label htmlFor="formationId" className="text-sm font-semibold text-slate-700">
                  Formation associée *
                </Label>
                <Input
                  id="formationId"
                  value={exam.formationId}
                  onChange={(e) => handleChange("formationId", e.target.value)}
                  placeholder="ID de la formation"
                  className="mt-1.5 h-11"
                  required
                />
              </div>

              <div>
                <Label htmlFor="duration" className="text-sm font-semibold text-slate-700">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Durée (minutes)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="5"
                  max="480"
                  value={Math.round(exam.duration / 60)}
                  onChange={(e) => handleChange("duration", parseInt(e.target.value) * 60)}
                  className="mt-1.5 h-11"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {Math.round(exam.duration / 60)} minutes = {exam.duration} secondes
                </p>
              </div>

              <div>
                <Label htmlFor="passingScore" className="text-sm font-semibold text-slate-700">
                  <BarChart3 className="w-4 h-4 inline mr-1" />
                  Score de réussite (%)
                </Label>
                <Input
                  id="passingScore"
                  type="number"
                  min="0"
                  max="100"
                  value={exam.passingScore}
                  onChange={(e) => handleChange("passingScore", parseInt(e.target.value))}
                  className="mt-1.5 h-11"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Les candidats avec ≥ {exam.passingScore}% obtiennent l'attestation
                </p>
              </div>
            </div>
          </Card>

          {/* Part 1: QCM */}
          <Card className="p-6 bg-white shadow-sm border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-bold text-slate-800">Partie 1 - QCM</h2>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="part1Enabled" className="text-sm text-slate-600">
                  Activée
                </Label>
                <Switch
                  id="part1Enabled"
                  checked={exam.part1Enabled}
                  onCheckedChange={(checked) => handleChange("part1Enabled", checked)}
                />
              </div>
            </div>

            {exam.part1Enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Nombre de questions
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={exam.part1Questions}
                    onChange={(e) => handleChange("part1Questions", parseInt(e.target.value))}
                    className="mt-1.5 h-11"
                  />
                </div>

                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Points attribués
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={exam.part1Points}
                    onChange={(e) => handleChange("part1Points", parseInt(e.target.value))}
                    className="mt-1.5 h-11"
                  />
                </div>

                <div className="flex items-end">
                  <Badge variant="secondary" className="h-11">
                    {exam.part1Points} points
                  </Badge>
                </div>
              </div>
            )}

            {!exam.part1Enabled && (
              <p className="text-sm text-slate-500 italic">
                Cette partie est désactivée. Les candidats ne la verront pas.
              </p>
            )}
          </Card>

          {/* Part 2: Questions ouvertes */}
          <Card className="p-6 bg-white shadow-sm border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-bold text-slate-800">Partie 2 - Questions ouvertes</h2>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="part2Enabled" className="text-sm text-slate-600">
                  Activée
                </Label>
                <Switch
                  id="part2Enabled"
                  checked={exam.part2Enabled}
                  onCheckedChange={(checked) => handleChange("part2Enabled", checked)}
                />
              </div>
            </div>

            {exam.part2Enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Nombre de questions
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={exam.part2Questions}
                    onChange={(e) => handleChange("part2Questions", parseInt(e.target.value))}
                    className="mt-1.5 h-11"
                  />
                </div>

                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Points attribués
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={exam.part2Points}
                    onChange={(e) => handleChange("part2Points", parseInt(e.target.value))}
                    className="mt-1.5 h-11"
                  />
                </div>

                <div className="flex items-end">
                  <Badge variant="secondary" className="h-11">
                    {exam.part2Points} points
                  </Badge>
                </div>
              </div>
            )}

            {!exam.part2Enabled && (
              <p className="text-sm text-slate-500 italic">
                Cette partie est désactivée. Les candidats ne la verront pas.
              </p>
            )}
          </Card>

          {/* Part 3: Étude de cas */}
          <Card className="p-6 bg-white shadow-sm border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-slate-800">Partie 3 - Étude de cas</h2>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="part3Enabled" className="text-sm text-slate-600">
                  Activée
                </Label>
                <Switch
                  id="part3Enabled"
                  checked={exam.part3Enabled}
                  onCheckedChange={(checked) => handleChange("part3Enabled", checked)}
                />
              </div>
            </div>

            {exam.part3Enabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">
                      Points attribués
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={exam.part3Points}
                      onChange={(e) => handleChange("part3Points", parseInt(e.target.value))}
                      className="mt-1.5 h-11"
                    />
                  </div>

                  <div className="flex items-end">
                    <Badge variant="secondary" className="h-11">
                      {exam.part3Points} points
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Mode de composition *
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card
                      className={`p-4 cursor-pointer transition-all ${
                        exam.part3Mode === "digital"
                          ? "border-2 border-blue-500 bg-blue-50"
                          : "border-2 border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => handleChange("part3Mode", "digital")}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <PenTool className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">Numérique</h3>
                          <p className="text-xs text-slate-500">Réponse directe dans l'app</p>
                        </div>
                        {exam.part3Mode === "digital" && (
                          <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />
                        )}
                      </div>
                      <ul className="text-xs text-slate-600 space-y-1">
                        <li>✅ Correction rapide</li>
                        <li>✅ Pas de numérisation</li>
                        <li>⚠️ Moins pratique sur mobile</li>
                      </ul>
                    </Card>

                    <Card
                      className={`p-4 cursor-pointer transition-all ${
                        exam.part3Mode === "physical"
                          ? "border-2 border-amber-500 bg-amber-50"
                          : "border-2 border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => handleChange("part3Mode", "physical")}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">Physique</h3>
                          <p className="text-xs text-slate-500">Feuilles de composition</p>
                        </div>
                        {exam.part3Mode === "physical" && (
                          <CheckCircle className="w-5 h-5 text-amber-600 ml-auto" />
                        )}
                      </div>
                      <ul className="text-xs text-slate-600 space-y-1">
                        <li>✅ Plus naturel pour rédiger</li>
                        <li>✅ Idéal pour schémas</li>
                        <li>⚠️ Numérisation requise</li>
                      </ul>
                    </Card>
                  </div>
                </div>

                <div>
                  <Label htmlFor="part3Subject" className="text-sm font-semibold text-slate-700">
                    Sujet de l'étude de cas *
                  </Label>
                  <Textarea
                    id="part3Subject"
                    value={exam.part3Subject}
                    onChange={(e) => handleChange("part3Subject", e.target.value)}
                    placeholder="Décrivez le scénario, le contexte, les questions..."
                    rows={6}
                    className="mt-1.5 resize-none"
                    required={exam.part3Enabled}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Ce sujet sera affiché aux candidats au début de la Partie 3
                  </p>
                </div>

                {exam.part3Mode === "physical" && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <AlertTitle className="text-amber-800">
                      Mode Physique Activé
                    </AlertTitle>
                    <AlertDescription className="text-amber-700 text-sm">
                      <p className="mt-2">
                        Les candidats rédigeront sur des feuilles de composition physiques.
                      </p>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li>Prévoyez des feuilles numérotées</li>
                        <li>Après l'examen, numérisez les copies</li>
                        <li>Les admins pourront consulter les scans lors de la correction</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {!exam.part3Enabled && (
              <p className="text-sm text-slate-500 italic">
                Cette partie est désactivée. Les candidats ne la verront pas.
              </p>
            )}
          </Card>

          {/* Summary */}
          <Card className="p-6 bg-gradient-to-r from-slate-50 to-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Résumé de la configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-sm text-slate-500">Durée totale</p>
                <p className="text-2xl font-bold text-slate-800">
                  {Math.round(exam.duration / 60)} min
                </p>
              </div>

              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-sm text-slate-500">Score de réussite</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {exam.passingScore}%
                </p>
              </div>

              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-sm text-slate-500">Total points</p>
                <p className="text-2xl font-bold text-blue-600">
                  {totalPoints} pts
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between p-4 bg-white rounded-lg">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">Barème personnalisé :</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {exam.part1Enabled && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    P1: {exam.part1Points} pts
                  </Badge>
                )}
                {exam.part2Enabled && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700">
                    P2: {exam.part2Points} pts
                  </Badge>
                )}
                {exam.part3Enabled && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    P3: {exam.part3Points} pts
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/admin/exams">
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Création...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Créer l'examen
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
