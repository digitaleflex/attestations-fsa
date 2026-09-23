"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Clock,
  FileText,
  XCircle,
  Laptop2,
  HandMetal,
  CheckCircle2,
  FileEdit,
  PenTool
} from "lucide-react";
import { Part, Question, Option } from "../types";

type Props = {
  part: Part;
  onUpdatePart: (updates: Partial<Part>) => void;
};

export function StepPartBuilder({ part, onUpdatePart }: Props) {
  const addQuestion = () => {
    const type = part.type === 'QCM' ? 'SINGLE_CHOICE' : 'OPEN';
    const newQuestions = [...part.questions, {
      text: "",
      type,
      points: part.type === 'QCM' ? 2 : 10,
      options: type === 'SINGLE_CHOICE' ? [
        { text: "", isCorrect: true },
        { text: "", isCorrect: false }
      ] : []
    }];
    onUpdatePart({ questions: newQuestions as Question[] });
  };

  const removeQuestion = (qIndex: number) => {
    const newQuestions = [...part.questions];
    newQuestions.splice(qIndex, 1);
    onUpdatePart({ questions: newQuestions });
  };

  const updateQuestion = (qIndex: number, updates: Partial<Question>) => {
    const newQuestions = [...part.questions];
    newQuestions[qIndex] = { ...newQuestions[qIndex], ...updates };
    onUpdatePart({ questions: newQuestions });
  };

  const addOption = (qIndex: number) => {
    const question = part.questions[qIndex];
    const newOptions = [...(question.options || []), { text: "", isCorrect: false }];
    updateQuestion(qIndex, { options: newOptions });
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const question = part.questions[qIndex];
    const newOptions = [...(question.options || [])];
    newOptions.splice(oIndex, 1);
    updateQuestion(qIndex, { options: newOptions });
  };

  const updateOption = (qIndex: number, oIndex: number, updates: Partial<Option>) => {
    const question = part.questions[qIndex];
    let newOptions = [...(question.options || [])];

    if (updates.isCorrect && question.type === 'SINGLE_CHOICE') {
      newOptions = newOptions.map(o => ({ ...o, isCorrect: false }));
    }

    newOptions[oIndex] = { ...newOptions[oIndex], ...updates };
    updateQuestion(qIndex, { options: newOptions });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-l-4 border-primary pl-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{part.title}</h2>
          <Badge variant="outline" className="mt-1 bg-primary/5 text-primary border-primary/20 px-3 py-1">
            {part.points} Points auto-attribués
          </Badge>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
          <Clock className="w-4 h-4 text-slate-400" />
          <Label className="text-xs font-bold text-slate-500">DURÉE (MIN)</Label>
          <Input
            type="number"
            value={part.duration}
            onChange={(e) => onUpdatePart({ duration: parseInt(e.target.value) || 0 })}
            className="w-20 h-8 text-center font-bold"
          />
        </div>
      </div>

      {part.type === 'CASE_STUDY' && (
        <div className="space-y-6">
          <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 shadow-sm">
            <Label className="text-sm font-black text-amber-800 flex items-center gap-2 uppercase tracking-widest mb-4">
              <FileEdit className="w-5 h-5" />
              Configuration de l'Étude de Cas
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card
                className={`p-4 cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                  part.mode === "digital"
                    ? "border-2 border-brand bg-brand/10 shadow-md"
                    : "border-2 border-slate-200 hover:border-brand/30 bg-white"
                }`}
                onClick={() => onUpdatePart({ mode: "digital" })}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${part.mode === "digital" ? "bg-brand text-white" : "bg-slate-100 text-slate-400 group-hover:bg-brand/10 group-hover:text-brand"}`}>
                    <Laptop2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Numérique</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Rédaction directe en ligne</p>
                  </div>
                  {part.mode === "digital" && <CheckCircle2 className="w-5 h-5 text-brand ml-auto" />}
                </div>
              </Card>

              <Card
                className={`p-4 cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                  part.mode === "physical"
                    ? "border-2 border-amber-500 bg-amber-50/50 shadow-md"
                    : "border-2 border-slate-200 hover:border-amber-200 bg-white"
                }`}
                onClick={() => onUpdatePart({ mode: "physical" })}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${part.mode === "physical" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-500"}`}>
                    <HandMetal className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Physique</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Rédaction sur papier</p>
                  </div>
                  {part.mode === "physical" && <CheckCircle2 className="w-5 h-5 text-amber-500 ml-auto" />}
                </div>
              </Card>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Mise en situation / Scénario détaillé
              </Label>
              <Textarea
                placeholder="Décrivez l'étude de cas, le contexte et les enjeux..."
                value={part.scenario || ""}
                onChange={(e) => onUpdatePart({ scenario: e.target.value })}
                className="min-h-[200px] border-amber-200 focus:ring-amber-100 bg-white rounded-xl resize-none font-medium text-slate-700"
              />
              <p className="text-[10px] text-slate-400 font-medium italic">Cet énoncé sera affiché en haut de la page pour le candidat.</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2 uppercase tracking-tight">
            <Plus className="w-3 h-3" /> Questions de la partie
          </h3>
          <Button onClick={addQuestion} variant="outline" size="sm" className="h-8 gap-2 bg-slate-50 border-slate-200 hover:bg-slate-100">
            <Plus className="w-4 h-4" /> Ajouter
          </Button>
        </div>

        <div className="space-y-4">
          {part.questions.map((q, qIdx) => (
            <Card key={qIdx} className="p-4 bg-white border-slate-100 shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-primary transition-colors" />
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs shrink-0 mt-1">
                    Q{qIdx + 1}
                  </div>
                  <div className="flex-1 space-y-3">
                    <Input
                      placeholder="Libellé de la question..."
                      value={q.text}
                      onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                      className="font-medium border-none shadow-none text-lg p-0 h-auto focus-visible:ring-0"
                    />
                    <div className="flex items-center gap-4 text-xs min-w-0 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Type:</span>
                        <select
                          value={q.type}
                          onChange={(e: any) => updateQuestion(qIdx, { type: e.target.value })}
                          className="bg-slate-50 px-2 py-1 rounded border-none outline-none font-semibold text-slate-600"
                        >
                          <option value="SINGLE_CHOICE">Choix Unique</option>
                          <option value="MULTIPLE_CHOICE">Choix Multiples</option>
                          <option value="OPEN">Question Ouverte</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Points:</span>
                        <Input
                          type="number"
                          value={q.points}
                          onChange={(e) => updateQuestion(qIdx, { points: parseFloat(e.target.value) || 0 })}
                          className="w-14 h-6 text-center text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(qIdx)}
                    className="text-slate-300 hover:text-rose-600 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && (
                  <div className="pl-4 sm:pl-12 space-y-2">
                    {q.options?.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-3">
                        <Switch
                          checked={opt.isCorrect}
                          onCheckedChange={(val) => updateOption(qIdx, oIdx, { isCorrect: val })}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                        <Input
                          placeholder={`Option ${oIdx + 1}...`}
                          value={opt.text}
                          onChange={(e) => updateOption(qIdx, oIdx, { text: e.target.value })}
                          className={`h-9 bg-slate-50/50 border-none transition-all ${opt.isCorrect ? 'bg-emerald-50 text-emerald-700 font-medium ring-1 ring-emerald-200' : ''}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(qIdx, oIdx)}
                          className="text-slate-300 hover:text-rose-600"
                        >
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addOption(qIdx)}
                      className="text-slate-400 hover:text-primary gap-2 h-7 px-2"
                    >
                      <Plus className="w-3 h-3" /> Ajouter une option
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {part.questions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-50/30 rounded-2xl border-2 border-dashed border-slate-100">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-400">Cliquez sur le bouton "Ajouter" pour créer une question</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
