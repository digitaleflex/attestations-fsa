"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  AlertCircle, CheckCircle, Settings, BarChart3, Cloud, CloudOff
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import DOMPurify from "dompurify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Type,
  Eye,
  Edit3
} from "lucide-react";

const STORAGE_KEY = "exam_draft";

export default function CreateExamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [creationStep, setCreationStep] = useState<string>("");
  const isInitialMount = useRef(true);
  
  // Exam settings
  const [exam, setExam] = useState({
    name: "",
    session: "",
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
    status: "DRAFT",
  });

  // Questions state
  const [qcmQuestions, setQcmQuestions] = useState<any[]>([
    { 
      text: "", 
      type: "SINGLE_CHOICE", 
      points: 1,
      options: [
        { text: "", isCorrect: true, feedback: "" },
        { text: "", isCorrect: false, feedback: "" },
        { text: "", isCorrect: false, feedback: "" },
        { text: "", isCorrect: false, feedback: "" }
      ]
    }
  ]);
  const [openQuestions, setOpenQuestions] = useState<any[]>([
    { text: "", points: 5 }
  ]);

  // Hydration state
  const [mounted, setMounted] = useState(false);

  // Score state for /20
  const [score20, setScore20] = useState(12);

  // Time state for HH:MM:SS
  const [time, setTime] = useState({
    h: 1,
    m: 0,
    s: 0
  });

  // Session state
  const [sessionMonth, setSessionMonth] = useState("Avril");
  const [sessionYear, setSessionYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch formations
  const { data: formations, isLoading: formationsLoading } = useQuery({
    queryKey: ["formations-list"],
    queryFn: async () => {
      return await apiFetch("/api/formations");
    }
  });

  // ✅ 1. Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.exam) setExam(parsed.exam);
        if (parsed.qcmQuestions) setQcmQuestions(parsed.qcmQuestions);
        if (parsed.openQuestions) setOpenQuestions(parsed.openQuestions);
        if (parsed.time) setTime(parsed.time);
        if (parsed.score20 !== undefined) setScore20(parsed.score20);
        if (parsed.sessionMonth) setSessionMonth(parsed.sessionMonth);
        if (parsed.sessionYear) setSessionYear(parsed.sessionYear);
        setIsDraftLoaded(true);
        toast.info("📝 Brouillon de l'examen restauré automatiquement");
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // ✅ 2. Auto-save to localStorage on every change (debounced 500ms)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      try {
        setIsSaving(true);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          exam, qcmQuestions, openQuestions, time, score20, sessionMonth, sessionYear,
        }));
        setIsSaving(false);
      } catch {
        setIsSaving(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [exam, qcmQuestions, openQuestions, time, score20, sessionMonth, sessionYear]);

  // ✅ 3. Warn before leaving page with unsaved data
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasData = exam.name || qcmQuestions.some(q => q.text) || openQuestions.some(q => q.text);
      if (hasData) {
        e.preventDefault();
        e.returnValue = "Des données non sauvegardées seront perdues. Voulez-vous vraiment quitter ?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [exam, qcmQuestions, openQuestions]);

  const handleRestoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.exam) setExam(parsed.exam);
        if (parsed.qcmQuestions) setQcmQuestions(parsed.qcmQuestions);
        if (parsed.openQuestions) setOpenQuestions(parsed.openQuestions);
        if (parsed.time) setTime(parsed.time);
        if (parsed.score20 !== undefined) setScore20(parsed.score20);
        toast.info("📝 Brouillon restauré");
      }
    } catch {
      toast.error("Erreur lors de la restauration du brouillon");
    }
  }, []);

  const handleTimeChange = (field: "h" | "m" | "s", bValue: string) => {
    const val = parseInt(bValue) || 0;
    const newTime = { ...time, [field]: val };
    setTime(newTime);
    // Update duration in seconds: (h*3600) + (m*60) + s
    const totalSeconds = (newTime.h * 3600) + (newTime.m * 60) + newTime.s;
    setExam(prev => ({ ...prev, duration: totalSeconds }));
  };


  useEffect(() => {
    setExam(prev => ({ ...prev, session: `${sessionMonth} ${sessionYear}` }));
  }, [sessionMonth, sessionYear]);

  const handleScoreChange = (val: string) => {
    if (val === "" || val === ".") {
      setScore20(val as any);
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) return;
    
    const clamped = Math.min(Math.max(num, 0), 20);
    setScore20(clamped);
    // Convert to percentage
    const percentage = Math.round((clamped / 20) * 100);
    setExam(prev => ({ ...prev, passingScore: percentage }));
  };

  // QCM Handlers
  const addQcmQuestion = () => {
    setQcmQuestions([...qcmQuestions, { 
      text: "", 
      type: "SINGLE_CHOICE", 
      points: 1, 
      options: [
        { text: "", isCorrect: false, feedback: "" },
        { text: "", isCorrect: false, feedback: "" },
        { text: "", isCorrect: false, feedback: "" },
        { text: "", isCorrect: false, feedback: "" }
      ] 
    }]);
  };

  const updateQcmQuestion = (index: number, field: string, value: any) => {
    const newQuestions = [...qcmQuestions];
    if (field === "points") {
      const num = parseFloat(value);
      newQuestions[index][field] = isNaN(num) ? 0 : num;
    } else {
      newQuestions[index][field] = value;
    }
    setQcmQuestions(newQuestions);
  };

  const updateQcmOption = (qIndex: number, oIndex: number, field: string, value: any) => {
    const newQuestions = [...qcmQuestions];
    newQuestions[qIndex].options[oIndex][field] = value;
    
    // If single choice and setting to correct, uncheck others
    if (newQuestions[qIndex].type === "SINGLE_CHOICE" && field === "isCorrect" && value === true) {
      newQuestions[qIndex].options.forEach((opt: any, i: number) => {
        if (i !== oIndex) opt.isCorrect = false;
      });
    }
    
    setQcmQuestions(newQuestions);
  };

  const removeQcmQuestion = (index: number) => {
    setQcmQuestions(qcmQuestions.filter((_, i) => i !== index));
  };

  // Open Question Handlers
  const addOpenQuestion = () => {
    setOpenQuestions([...openQuestions, { text: "", points: 5 }]);
  };

  const updateOpenQuestion = (index: number, field: string, value: any) => {
    const newQuestions = [...openQuestions];
    if (field === "points") {
      const num = parseFloat(value);
      newQuestions[index][field] = isNaN(num) ? 0 : num;
    } else {
      newQuestions[index][field] = value;
    }
    setOpenQuestions(newQuestions);
  };

  const removeOpenQuestion = (index: number) => {
    setOpenQuestions(openQuestions.filter((_, i) => i !== index));
  };

  // Markdown Helper
  const renderMarkdown = (text: string) => {
    if (!text) return "";
    let html = text
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.*?)\*/g, "<i>$1</i>")
      // Listes à puces
      .replace(/^-\s(.*)$/gm, "<li>$1</li>")
      .replace(/<\/li>\n<li>/g, "</li><li>")
      .replace(/(<li>[\s\S]*<\/li>)/, "<ul>$1</ul>")
      // Listes numérotées
      .replace(/^\d\.\s(.*)$/gm, "<li class='list-decimal'>$1</li>")
      .replace(/<\/li>\n<li class='list-decimal'>/g, "</li><li class='list-decimal'>")
      .replace(/(<li class='list-decimal'>[\s\S]*<\/li>)/, "<ol class='list-decimal pl-4'>$1</ol>")
      // Retours à la ligne (Paragraphes vs Sauts simples)
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>");
    
    // Encapsuler dans un paragraphe si nécessaire
    html = `<p>${html}</p>`;
    
    // Nettoyer les balises vides/erronées dues au remplacement
    html = html.replace(/<p><\/p>/g, "")
               .replace(/<p><br\/>/g, "<p>")
               .replace(/<br\/><\/p>/g, "</p>")
               .replace(/<p><ul>/g, "<ul>")
               .replace(/<\/ul><\/p>/g, "</ul>")
               .replace(/<p><ol/g, "<ol")
               .replace(/<\/ol><\/p>/g, "</ol>");
    
    // Sécurisation (uniquement côté client)
    if (typeof window !== "undefined") {
      const purify = DOMPurify as any;
      if (typeof purify.sanitize === 'function') {
        return purify.sanitize(html);
      }
      if (typeof purify === 'function') {
        return purify(window).sanitize(html);
      }
    }
    return html;
  };

  const insertFormat = (format: string) => {
    const textarea = document.getElementById("part3Subject") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = exam.part3Subject || "";
    const selected = text.substring(start, end);

    let newText = "";
    if (format === "bold") newText = text.substring(0, start) + "**" + (selected || "texte") + "**" + text.substring(end);
    if (format === "italic") newText = text.substring(0, start) + "*" + (selected || "texte") + "*" + text.substring(end);
    if (format === "list") newText = text.substring(0, start) + "\n- " + (selected || "élément") + text.substring(end);
    if (format === "ordered") newText = text.substring(0, start) + "\n1. " + (selected || "étape") + text.substring(end);

    handleChange("part3Subject", newText);
    textarea.focus();
  };

  // Auto-sync total points
  useEffect(() => {
    const p1Raw = qcmQuestions.reduce((acc, q) => acc + (q.points || 0), 0);
    const p2Raw = openQuestions.reduce((acc, q) => acc + (q.points || 0), 0);
    
    // Round to avoid 20.0099999
    const p1Total = Number(p1Raw.toFixed(2));
    const p2Total = Number(p2Raw.toFixed(2));
    
    setExam(prev => ({ 
      ...prev, 
      part1Questions: qcmQuestions.length,
      part1Points: p1Total,
      part2Questions: openQuestions.length,
      part2Points: p2Total
    }));
  }, [qcmQuestions, openQuestions]);

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
    setCreationStep("📝 Création de l'examen...");

    try {
      const payload = {
        ...exam,
        qcmQuestions,
        openQuestions
      };

      // Simulate progress steps (API processes sequentially)
      const totalQuestions = qcmQuestions.length + openQuestions.length;
      const steps = [
        { label: "📝 Création de l'examen...", delay: 500 },
        { label: `📋 Partie 1 : ${qcmQuestions.length} questions QCM...`, delay: 1000 },
        { label: `📝 Partie 2 : ${openQuestions.length} questions ouvertes...`, delay: 800 },
        { label: exam.part3Enabled ? "📖 Partie 3 : Étude de cas..." : null, delay: 400 },
        { label: "✅ Finalisation...", delay: 300 },
      ].filter(s => s.label !== null);

      // Start progress simulation
      for (let i = 0; i < steps.length; i++) {
        setCreationStep(steps[i].label);
        await new Promise(r => setTimeout(r, steps[i].delay));
      }

      await apiFetch("/api/admin/exams", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCreationStep("✅ Examen créé avec succès !");
      toast.success("✅ Examen créé avec succès !");
      // ✅ Clear draft after successful creation
      localStorage.removeItem(STORAGE_KEY);

      // Small delay before redirect so user sees success message
      await new Promise(r => setTimeout(r, 800));
      router.push("/admin/exams");
    } catch (error: any) {
      setCreationStep("");
      toast.error(error.message || "Erreur lors de la création");
    } finally {
      setLoading(false);
      setCreationStep("");
    }
  };

  const currentTotal = (exam.part1Enabled ? exam.part1Points : 0) +
                      (exam.part2Enabled ? exam.part2Points : 0) +
                      (exam.part3Enabled ? exam.part3Points : 0);

  const isBalanced = currentTotal === 100;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Use the new variable name to avoid any collision
  const totalPoints = Number(parseFloat(currentTotal.toFixed(2)));
  const isPointsBalanced = totalPoints === 100;

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
          <div className="flex items-center gap-2">
            {/* Save indicator */}
            <Badge variant="outline" className="gap-1.5">
              {isSaving ? (
                <>
                  <CloudOff className="w-3 h-3 animate-pulse" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  Brouillon auto-sauvegardé
                </>
              )}
            </Badge>
            <Link href="/admin/exams">
              <Button variant="outline" size="sm">← Retour</Button>
            </Link>
          </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                <div>
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

                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Session de l'examen *
                  </Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select value={sessionMonth} onValueChange={setSessionMonth}>
                      <SelectTrigger className="h-11 w-[150px]">
                        <SelectValue placeholder="Mois" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={sessionYear}
                      onChange={(e) => setSessionYear(e.target.value)}
                      className="h-11 w-[100px]"
                      placeholder="Année"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 capitalize">Format: {exam.session}</p>
                </div>
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
                <div className="mt-1.5">
                  <Select 
                    onValueChange={(value) => handleChange("formationId", value)}
                    value={exam.formationId}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={formationsLoading ? "Chargement..." : "Sélectionner une formation"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formations?.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} ({f.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Durée de l'examen (HH:MM:SS) *
                </Label>
                <div className="flex items-center gap-2 mt-1.5 h-11">
                  <div className="flex-1">
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      placeholder="HH"
                      value={time.h}
                      onChange={(e) => handleTimeChange("h", e.target.value)}
                      className="text-center"
                    />
                    <p className="text-[10px] text-slate-400 font-bold uppercase text-center mt-1">HEURES</p>
                  </div>
                  <span className="font-bold text-slate-400 pb-5">:</span>
                  <div className="flex-1">
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="MM"
                      value={time.m}
                      onChange={(e) => handleTimeChange("m", e.target.value)}
                      className="text-center"
                    />
                    <p className="text-[10px] text-slate-400 font-bold uppercase text-center mt-1">MIN</p>
                  </div>
                  <span className="font-bold text-slate-400 pb-5">:</span>
                  <div className="flex-1">
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="SS"
                      value={time.s}
                      onChange={(e) => handleTimeChange("s", e.target.value)}
                      className="text-center"
                    />
                    <p className="text-[10px] text-slate-400 font-bold uppercase text-center mt-1">SEC</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-5">
                  Durée totale : {exam.duration} secondes
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="passingScore" className="text-sm font-semibold text-slate-700">
                    <BarChart3 className="w-4 h-4 inline mr-1" />
                    Moyenne de réussite (/20) *
                  </Label>
                  <Badge variant={isPointsBalanced ? "outline" : "destructive"} className={isPointsBalanced ? "bg-emerald-50 text-emerald-700 h-5" : "bg-rose-50 text-rose-700 h-5"}>
                    Barème total : {totalPoints} / 100
                  </Badge>
                </div>
                <div className="relative mt-1.5 h-11">
                  <Input
                    id="passingScore"
                    type="number"
                    min="0"
                    max="20"
                    step="0.25"
                    value={score20 || 0}
                    onChange={(e) => handleScoreChange(e.target.value)}
                    className="h-11 pr-12 text-lg font-bold"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-400 font-bold">/ 20</div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Équivalent à <span className="font-bold text-emerald-600">{exam.passingScore}%</span> de réussite
                </p>
              </div>

              <div className="flex flex-col justify-center">
                <Label htmlFor="status" className="text-sm font-semibold text-slate-700 mb-2">
                  Statut de l'examen
                </Label>
                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <Switch
                    id="status"
                    checked={exam.status === "PUBLISHED"}
                    onCheckedChange={(checked) => handleChange("status", checked ? "PUBLISHED" : "DRAFT")}
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      {exam.status === "PUBLISHED" ? "🚀 Publié" : "📝 Brouillon"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {exam.status === "PUBLISHED" ? "Visible par les candidats" : "Visible uniquement par les admins"}
                    </p>
                  </div>
                </div>
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
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">
                      Points de la partie (Total sur 20)
                    </Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.25"
                        value={exam.part1Points || 0}
                        onChange={(e) => handleChange("part1Points", parseFloat(e.target.value) || 0)}
                        className="mt-1.5 h-11"
                      />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 text-slate-400">
                      Nombre de questions
                    </Label>
                    <div className="h-11 flex items-center px-4 bg-slate-50 border rounded-lg text-slate-500 font-bold">
                      {qcmQuestions.length} questions
                    </div>
                  </div>
                </div>

                {/* Question Builder */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Liste des questions QCM
                  </h3>
                  
                  {qcmQuestions.map((q, qIndex) => (
                    <Card key={qIndex} className="p-4 bg-slate-50/50 border-slate-200 shadow-none">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mt-1">
                            {qIndex + 1}
                          </span>
                          <div className="flex-1 space-y-3">
                            <Input
                              placeholder="Énoncé de la question..."
                              value={q.text}
                              onChange={(e) => updateQcmQuestion(qIndex, "text", e.target.value)}
                              className="bg-white font-semibold"
                            />
                            
                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 bg-white/50 p-2 rounded border border-dashed">
                              <div className="flex items-center gap-2">
                                <Settings className="w-3 h-3" />
                                Type :
                                <select 
                                  value={q.type} 
                                  onChange={(e) => updateQcmQuestion(qIndex, "type", e.target.value)}
                                  className="bg-transparent border-none p-0 h-auto font-bold text-blue-600 cursor-pointer focus:ring-0"
                                >
                                  <option value="SINGLE_CHOICE">Choix Unique</option>
                                  <option value="MULTIPLE_CHOICE">Choix Multiple</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-2">
                                <Plus className="w-3 h-3" />
                                Points :
                                <Input 
                                  type="number" 
                                  step="0.25"
                                  value={q.points || 0} 
                                  onChange={(e) => updateQcmQuestion(qIndex, "points", e.target.value)}
                                  className="h-7 w-24 px-3 border border-slate-200 rounded-lg bg-white font-bold text-blue-600 text-center shadow-sm"
                                />
                              </div>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-rose-400 hover:text-rose-600 h-9 w-9"
                            onClick={() => removeQcmQuestion(qIndex)}
                            disabled={qcmQuestions.length === 1}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3 pl-9">
                          {q.options.map((opt: any, oIndex: number) => (
                            <div key={oIndex} className="space-y-2">
                              <div className="flex items-center gap-3">
                                <div 
                                  className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all border-2 ${
                                    opt.isCorrect
                                    ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" 
                                    : "bg-white border-slate-200 text-slate-400 hover:border-blue-400"
                                  }`}
                                  onClick={() => updateQcmOption(qIndex, oIndex, "isCorrect", !opt.isCorrect)}
                                >
                                  {["A", "B", "C", "D"][oIndex]}
                                </div>
                                <Input
                                  value={opt.text}
                                  onChange={(e) => updateQcmOption(qIndex, oIndex, "text", e.target.value)}
                                  placeholder={`Réponse ${["A", "B", "C", "D"][oIndex]}`}
                                  className={`text-sm h-9 bg-white transition-all ${opt.isCorrect ? "border-emerald-200 bg-emerald-50/20" : ""}`}
                                />
                              </div>
                              <div className="pl-9">
                                <div className="relative">
                                  <FileText className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-300" />
                                  <Input
                                    value={opt.feedback}
                                    onChange={(e) => updateQcmOption(qIndex, oIndex, "feedback", e.target.value)}
                                    placeholder="Explication ou correction (optionnel)..."
                                    className="text-[10px] h-8 pl-8 bg-slate-50/50 border-none italic"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addQcmQuestion} 
                    className="w-full border-dashed border-2 hover:bg-blue-50 hover:border-blue-300 gap-2 h-12"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter une question QCM
                  </Button>
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
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">
                      Points de la partie (Total sur 20)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.25"
                      value={exam.part2Points || 0}
                      onChange={(e) => handleChange("part2Points", parseFloat(e.target.value) || 0)}
                      className="mt-1.5 h-11"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 text-slate-400">
                      Nombre de questions
                    </Label>
                    <div className="h-11 flex items-center px-4 bg-slate-50 border rounded-lg text-slate-500 font-bold">
                      {openQuestions.length} questions
                    </div>
                  </div>
                </div>

                {/* Question Builder */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Liste des questions ouvertes
                  </h3>
                  
                  {openQuestions.map((q, oIndex) => (
                    <Card key={oIndex} className="p-4 bg-slate-50/50 border-slate-200 shadow-none">
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                          {oIndex + 1}
                        </span>
                        <div className="flex-1 space-y-3">
                          <Input
                            placeholder="Libellé de la question..."
                            value={q.text}
                            onChange={(e) => updateOpenQuestion(oIndex, "text", e.target.value)}
                            className="bg-white"
                          />
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                             <Plus className="w-3 h-3" />
                             Points :
                             <Input 
                               type="number" 
                               step="0.25"
                               value={q.points || 0} 
                               onChange={(e) => updateOpenQuestion(oIndex, "points", e.target.value)}
                               className="h-7 w-24 border border-slate-200 rounded-lg bg-white font-bold text-purple-600 px-3 text-center shadow-sm"
                             />
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-rose-400 hover:text-rose-600 h-9 w-9"
                          onClick={() => removeOpenQuestion(oIndex)}
                          disabled={openQuestions.length === 1}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addOpenQuestion} 
                    className="w-full border-dashed border-2 hover:bg-purple-50 hover:border-purple-300 gap-2 h-12"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter une question ouverte
                  </Button>
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
                      step="0.25"
                      value={exam.part3Points || 0}
                      onChange={(e) => handleChange("part3Points", parseFloat(e.target.value) || 0)}
                      className="mt-1.5 h-11"
                    />
                  </div>

                  <div className="flex items-end">
                    <Badge variant="secondary" className="h-11">
                      {Number(parseFloat((exam.part3Points || 0).toFixed(2)))} points
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
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="part3Subject" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      Énoncé de l'étude de cas *
                    </Label>
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-600 hover:text-blue-600"
                        onClick={() => insertFormat("bold")}
                        title="Gras"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-600 hover:text-blue-600"
                        onClick={() => insertFormat("italic")}
                        title="Italique"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-600 hover:text-blue-600"
                        onClick={() => insertFormat("list")}
                        title="Liste à puces"
                      >
                        <List className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-600 hover:text-blue-600"
                        onClick={() => insertFormat("ordered")}
                        title="Liste numérotée"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Editor */}
                    <div className="relative group">
                      <Textarea
                        id="part3Subject"
                        value={exam.part3Subject || ""}
                        onChange={(e) => handleChange("part3Subject", e.target.value)}
                        placeholder="Utilisez **gras** pour le gras, *italique* et - pour les listes..."
                        rows={12}
                        className="resize-none font-mono text-sm border-slate-200 group-focus-within:border-blue-400 group-focus-within:ring-2 group-focus-within:ring-blue-50"
                        required={exam.part3Enabled}
                      />
                    </div>

                    {/* Preview */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 overflow-y-auto max-h-[290px] relative">
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <Eye className="w-3 h-3" />
                        APERÇU EN DIRECT
                      </div>
                      <div 
                        className="prose prose-sm max-w-none text-slate-700 rich-text-preview" 
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(exam.part3Subject || "") }}
                      />
                      {(!exam.part3Subject) && (
                        <p className="text-slate-400 italic text-sm text-center mt-10">
                          Commencez à rédiger pour voir l'aperçu ici...
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                    <Type className="w-3 h-3" />
                    Supporte le formatage Markdown simple.
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
                  {String(time.h).padStart(2, '0')}:{String(time.m).padStart(2, '0')}:{String(time.s).padStart(2, '0')}
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
                    P1: {Number(parseFloat((exam.part1Points || 0).toFixed(2)))} pts
                  </Badge>
                )}
                {exam.part2Enabled && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700">
                    P2: {Number(parseFloat((exam.part2Points || 0).toFixed(2)))} pts
                  </Badge>
                )}
                {exam.part3Enabled && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    P3: {Number(parseFloat((exam.part3Points || 0).toFixed(2)))} pts
                  </Badge>
                )}
              </div>
            </div>

            {!isPointsBalanced && (
              <Alert className="mt-4 bg-rose-50 border-rose-200 py-3">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <AlertDescription className="text-rose-700 text-xs text-balance">
                  Attention : Le total de votre barème ({totalPoints}) est différent de 100. Pour une notation cohérente (sur 100%), essayez d'ajuster les points de chaque question.
                </AlertDescription>
              </Alert>
            )}

            {isPointsBalanced && (
              <Alert className="mt-4 bg-emerald-50 border-emerald-200 py-3">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <AlertDescription className="text-emerald-700 text-xs">
                  Parfait ! Votre barème est bien équilibré sur 100 points.
                </AlertDescription>
              </Alert>
            )}
          </Card>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/admin/exams">
              <Button type="button" variant="outline" disabled={loading}>
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
                  {creationStep || "Création..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Créer l'examen
                </>
              )}
            </Button>
          </div>

          {/* Progress steps */}
          {loading && (
            <Card className="p-4 bg-slate-50 border-slate-200">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full" />
                  Progression de la création
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Examen", done: true },
                    { label: `Partie 1 : ${qcmQuestions.length} QCM`, done: true, active: exam.part1Enabled },
                    { label: `Partie 2 : ${openQuestions.length} questions`, done: true, active: exam.part2Enabled },
                    { label: "Partie 3 : Étude de cas", done: false, active: exam.part3Enabled },
                  ].filter(s => s.active !== false).map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        i < 2 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                      }`}>
                        {i < 2 ? "✓" : i + 1}
                      </div>
                      <span className={i < 2 ? "text-emerald-700 font-medium" : "text-slate-400"}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </form>
      </main>
    </div>
  );
}
