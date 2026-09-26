"use client";

import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExamFormData } from "../types";
import React, { useEffect, useState } from "react";
import { Calendar, FileText, BookOpen, Info, Target, Shuffle, Eye, Sunrise } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  APP_TIMEZONE_LABEL,
  APP_TIMEZONE_SHORT,
  formatAppDateTime,
  formatAppLongDate,
  fromAppWallClock,
} from "@/lib/exams/schedule-ui";

type Props = {
  formData: ExamFormData;
  updateFormData: (updates: Partial<ExamFormData>) => void;
};

export function StepGeneral({ formData, updateFormData }: Props) {
  const [formations, setFormations] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    fetch("/api/formations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFormations(
            data.map((f: { id?: string; name: string }) => ({ id: f.id || f.name, name: f.name })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleStatusChange = (value: string) => {
    updateFormData({ status: value as "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED" });
  };

  /**
   * Relecture de l'instant qui sera réellement stocké.
   *
   * `scheduledAt` et `opensOn` sont saisis en heure murale Porto-Novo ; la base
   * stocke de l'UTC. Afficher les deux côte à côte supprime la seule vraie
   * source d'erreur de ce formulaire : un admin qui saisit 08:00 en croyant
   * écrire de l'UTC, et fait commencer l'épreuve une heure trop tôt.
   */
  const schedulePreview = (() => {
    const wallClock = formData.scheduledAt || "";
    const startInstant = fromAppWallClock(wallClock);
    const openInstant = formData.opensOn
      ? fromAppWallClock(`${formData.opensOn}T00:00`)
      : null;

    if (!wallClock && !formData.opensOn) return "";
    if (wallClock && !startInstant) return "Date d'épreuve illisible.";
    if (formData.opensOn && !openInstant) return "Jour d'ouverture illisible.";

    const lines: string[] = [];
    if (openInstant) {
      lines.push(
        `Ouverture : ${formatAppLongDate(openInstant)} 00:00 (${APP_TIMEZONE_LABEL}) = ${openInstant.toISOString()}`,
      );
    }
    if (startInstant) {
      lines.push(
        `Début    : ${formatAppDateTime(startInstant)} (${APP_TIMEZONE_SHORT}) = ${startInstant.toISOString()}`,
      );
    }
    if (openInstant && startInstant && startInstant.getTime() < openInstant.getTime()) {
      lines.push(
        "⚠ Le début précède l'ouverture : le candidat verra l'épreuve mais ne pourra pas la démarrer.",
      );
    }
    return lines.join("\n");
  })();

  // Un examen publié dont l'heure est future reste verrouillé côté serveur. Ce
  // n'est pas bloquant ici (le serveur tranche), mais l'admin doit le savoir.
  const publishedButLocked =
    formData.status === "PUBLISHED" &&
    (() => {
      const startInstant = fromAppWallClock(formData.scheduledAt || "");
      return startInstant ? startInstant.getTime() > Date.now() : false;
    })();


  return (
    <div className="space-y-6">
      <div className="border-l-4 border-primary pl-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">
          Informations Générales
        </h2>
        <p className="text-slate-500 text-sm">
          Définissez le titre, la date de programmation et le statut de publication.
        </p>
      </div>
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-semibold">
            <FileText className="w-4 h-4 inline mr-2" />
            Titre de l&apos;Examen *
          </Label>
          <Input
            id="title"
            placeholder="Ex: Examen Final - Gestion de Projet"
            value={formData.title}
            onChange={(e) => updateFormData({ title: e.target.value })}
            className="h-12 text-lg focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="examType" className="text-sm font-semibold">
            <Target className="w-4 h-4 inline mr-2" />
            Type d&apos;Examen *
          </Label>
          <select
            id="examType"
            className="w-full h-11 px-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white font-bold"
            value={formData.type || "OFFICIAL"}
            onChange={(e) => updateFormData({ type: e.target.value as "OFFICIAL" | "MOCK" })}
          >
            <option value="OFFICIAL">🎓 Examen Officiel (Génère une attestation)</option>
            <option value="MOCK">📝 Examen Blanc (Entraînement uniquement)</option>
          </select>
          <p className="text-[10px] text-slate-400 font-medium">
            Les examens blancs ne génèrent pas d&apos;attestation, même en cas de réussite.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="formationId" className="text-sm font-semibold">
            <BookOpen className="w-4 h-4 inline mr-2" />
            Formation *
          </Label>
          <select
            id="formationId"
            className="w-full h-11 px-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white"
            value={formData.formationId || ""}
            onChange={(e) =>
              updateFormData({ formationId: e.target.value })
            }
          >
            <option value="">Sélectionner une formation</option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold">
            Description (optionnel)
          </Label>
          <Textarea
            id="description"
            placeholder="Instructions pour les candidats..."
            value={formData.description || ""}
            onChange={(e) => updateFormData({ description: e.target.value })}
            className="min-h-[100px] resize-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* ✅ PROGRAMMATION & STATUT */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-brand" />
            <h3 className="font-extrabold text-slate-800 uppercase tracking-tight text-sm">Programmation &amp; Statut</h3>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            Toutes les heures de ce formulaire sont saisies en{" "}
            <strong className="font-bold text-slate-700">{APP_TIMEZONE_LABEL}</strong>,
            quel que soit le fuseau de votre ordinateur. Les candidats voient
            la même chose.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="exam-date" className="text-sm font-semibold text-slate-700">
                Date de l&apos;Examen (JJ/MM/AAAA)
              </Label>
              <DateInput
                id="exam-date"
                value={formData.scheduledAt?.split("T")[0] || ""}
                onChange={(e) => {
                  const date = e.target.value;
                  const time = formData.scheduledAt?.split("T")[1] || "08:00";
                  // Le jour d'ouverture suit la date d'épreuve tant que
                  // l'admin ne l'a pas detached : changer la date d'un examen
                  // déjà ouvert ne doit pas le refermer ailleurs.
                  const followsExamDate =
                    !formData.opensOn ||
                    formData.opensOn === formData.scheduledAt?.split("T")[0];
                  updateFormData({
                    scheduledAt: `${date}T${time}`,
                    ...(followsExamDate ? { opensOn: date } : {}),
                  });
                }}
                className="h-12 focus:ring-2 focus:ring-brand/20 font-bold"
                aria-label="Date de l'examen (jour, mois, année)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exam-time" className="text-sm font-semibold text-slate-700">
                Heure (Format 24h)
              </Label>
              <Input
                id="exam-time"
                type="time"
                value={formData.scheduledAt?.split("T")[1] || "08:00"}
                onChange={(e) => {
                  const time = e.target.value;
                  const date = formData.scheduledAt?.split("T")[0] || "";
                  updateFormData({ scheduledAt: `${date}T${time}` });
                }}
                className="h-12 focus:ring-2 focus:ring-brand/20 font-bold"
                aria-label="Heure de l'examen (format 24 heures)"
                aria-describedby="exam-schedule-preview"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="exam-opens-on" className="text-sm font-semibold text-slate-700">
                Jour d&apos;ouverture au public
              </Label>
              <DateInput
                id="exam-opens-on"
                value={formData.opensOn || ""}
                onChange={(e) => updateFormData({ opensOn: e.target.value })}
                className="h-12 focus:ring-2 focus:ring-brand/20 font-bold"
                aria-label="Jour d'ouverture au public (jour, mois, année)"
                aria-describedby="exam-opens-on-help"
              />
              <p id="exam-opens-on-help" className="text-[10px] font-medium leading-relaxed text-slate-400">
                À minuit ce jour-là, l&apos;épreuve devient visible : les
                candidats voient son titre et ses horaires, mais ni le contenu,
                ni le barème, ni la durée. Avant l&apos;heure prévue ci-dessus, le
                démarrage reste refusé.
              </p>
            </div>

            {/* Relecture inattaquable : l'admin voit exactement l'instant UTC
                qui sera stocké, donc il peut vérifier ce que la base recevra. */}
            <p
              id="exam-schedule-preview"
              className="whitespace-pre-line md:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600"
            >
              {schedulePreview || "Renseignez une date pour voir l'instant stocké."}
            </p>

            <div className="md:col-span-2">
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-semibold text-slate-700">
                  Statut de publication
                </Label>
                <select
                  id="status"
                  className="w-full h-11 px-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                  value={formData.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="DRAFT">📝 Brouillon</option>
                  <option value="SCHEDULED">📅 Programmé</option>
                  <option value="PUBLISHED">✅ Publié (Disponible)</option>
                  <option value="ARCHIVED">📦 Archivé</option>
                </select>
              </div>
            </div>

            {formData.status === "SCHEDULED" && !formData.scheduledAt && (
              <div className="md:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-sm font-bold text-rose-600">
                  La date et l&apos;heure de programmation sont requises pour un
                  examen au statut « Programmé ».
                </p>
              </div>
            )}

            {publishedButLocked && (
              <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="flex items-start gap-2 text-sm font-medium text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Examen publié mais encore verrouillé : aucun candidat ne
                    pourra le démarrer avant{" "}
                    {formatAppDateTime(
                      fromAppWallClock(formData.scheduledAt),
                    )}{" "}
                    ({APP_TIMEZONE_SHORT}). Choisissez « Programmé » si c&apos;est
                    l&apos;effet recherché.
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ⚙️ PARAMÈTRES DE SESSION ET DURÉE */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-5 h-5 text-slate-600" />
            <h3 className="font-extrabold text-slate-800 uppercase tracking-tight text-sm">Détails de l&apos;épreuve</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="exam-session-month" className="text-sm font-semibold text-slate-700">
                Session de l&apos;Examen
              </Label>
              <div className="flex gap-2">
                <select
                  id="exam-session-month"
                  className="flex-1 h-12 px-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-slate-400/20 outline-none bg-white font-bold"
                  value={formData.session?.split(" ")[0] || ""}
                  onChange={(e) => {
                    const month = e.target.value;
                    const year = formData.session?.split(" ")[1] || new Date().getFullYear().toString();
                    updateFormData({ session: `${month} ${year}`.trim() });
                  }}
                >
                  <option value="">Mois</option>
                  {["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <Input
                  id="exam-session-year"
                  type="number"
                  placeholder="Année"
                  className="w-24 h-12 font-bold"
                  value={formData.session?.split(" ")[1] || new Date().getFullYear().toString()}
                  onChange={(e) => {
                    const year = e.target.value;
                    const month = formData.session?.split(" ")[0] || "JANVIER";
                    updateFormData({ session: `${month} ${year}`.trim() });
                  }}
                />
              </div>
            </div>

            <fieldset className="space-y-2 md:col-span-2">
              <legend className="text-sm font-semibold text-slate-700">Durée Totale (HH:MM:SS)</legend>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    id="exam-duration-hours"
                    type="number"
                     aria-label="Heures de la durée totale"
                    placeholder="HH"
                    min="0"
                    value={Math.floor((formData.duration || 0) / 3600)}
                    onChange={(e) => {
                      const h = parseInt(e.target.value) || 0;
                      const current = formData.duration || 0;
                      const m = Math.floor((current % 3600) / 60);
                      const s = current % 60;
                      updateFormData({ duration: h * 3600 + m * 60 + s });
                    }}
                    className="text-center font-black"
                  />
                  <p className="text-[9px] text-center text-slate-400 mt-1 font-bold">HEURES</p>
                </div>
                <span className="text-xl font-bold text-slate-300 mb-4">:</span>
                <div className="flex-1">
                  <Input
                    id="exam-duration-minutes"
                    type="number"
                     aria-label="Minutes de la durée totale"
                    placeholder="MM"
                    min="0"
                    max="59"
                    value={Math.floor(((formData.duration || 0) % 3600) / 60)}
                    onChange={(e) => {
                      const m = parseInt(e.target.value) || 0;
                      const current = formData.duration || 0;
                      const h = Math.floor(current / 3600);
                      const s = current % 60;
                      updateFormData({ duration: h * 3600 + m * 60 + s });
                    }}
                    className="text-center font-black"
                  />
                  <p className="text-[9px] text-center text-slate-400 mt-1 font-bold">MINUTES</p>
                </div>
                <span className="text-xl font-bold text-slate-300 mb-4">:</span>
                <div className="flex-1">
                  <Input
                    id="exam-duration-seconds"
                    type="number"
                     aria-label="Secondes de la durée totale"
                    placeholder="SS"
                    min="0"
                    max="59"
                    value={(formData.duration || 0) % 60}
                    onChange={(e) => {
                      const s = parseInt(e.target.value) || 0;
                      const current = formData.duration || 0;
                      const h = Math.floor(current / 3600);
                      const m = Math.floor((current % 3600) / 60);
                      updateFormData({ duration: h * 3600 + m * 60 + s });
                    }}
                    className="text-center font-black"
                  />
                  <p className="text-[9px] text-center text-slate-400 mt-1 font-bold">SECONDES</p>
                </div>
              </div>
            </fieldset>
          </div>
        </div>

        {/* 🏆 CONFIGURATION DE RÉUSSITE & OPTIONS */}
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-brand" />
            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Paramètres de l&apos;Épreuve</h3>
          </div>

          <div className="space-y-6">
            {/* PASSING SCORE */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-bold text-slate-700">Seuil de Réussite</Label>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-tight">Note minimum sur 20 requise</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-24">
                    <Input
                      type="number"
                      min="0"
                      max="20"
                      step="1"
                      placeholder="13"
                      value={((formData.passingScore || 65) * 20) / 100}
                      onChange={(e) => {
                        const noteSur20 = parseFloat(e.target.value) || 0;
                        updateFormData({ passingScore: (noteSur20 * 100) / 20 });
                      }}
                      className="h-10 pr-8 font-black text-brand-dark text-center"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">/20</span>
                  </div>

                  <div className="flex items-center gap-1 bg-brand/10 px-3 py-1 rounded-lg border border-brand/20 shadow-sm">
                    <span className="text-xs font-bold text-brand">Soit</span>
                    <span className="text-sm font-black text-brand-dark">{Math.round(formData.passingScore || 65)}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            {/* TOGGLES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-brand/30 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-brand" />
                    <Label className="font-bold text-slate-800 cursor-pointer">Aléatoire</Label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Mélanger les questions</p>
                </div>
                <Switch
                  checked={formData.randomizeQuestions || false}
                  onCheckedChange={(checked) => updateFormData({ randomizeQuestions: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-brand/30 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-brand" />
                    <Label className="font-bold text-slate-800 cursor-pointer">Résultats</Label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Affichage immédiat du score</p>
                </div>
                <Switch
                  checked={formData.showResults || false}
                  onCheckedChange={(checked) => updateFormData({ showResults: checked })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
