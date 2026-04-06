"use client";

import * as React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const CATEGORIES_SUGGESTIONS = [
  "Aquaculture",
  "Transformation",
  "Gestion",
  "Agriculture",
  "Elevage",
  "Peche",
  "Commerce",
  "Administration",
];

export default function NewFormationPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    skills: [] as string[],
  });
  const [skillInput, setSkillInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !form.skills.includes(skillInput.trim())) {
      setForm((prev) => ({ ...prev, skills: [...prev.skills, skillInput.trim()] }));
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la creation");
      }

      setSuccess(true);
      toast.success("Formation creee avec succes !");
      setTimeout(() => router.push("/admin/formations"), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/formations">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Nouvelle Formation</h1>
            <p className="text-sm text-slate-500">Ajoutez une formation au catalogue</p>
          </div>
        </div>

        <Card className="p-8 bg-white shadow-lg">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-6 border-emerald-200 bg-emerald-50">
              <Check className="w-4 h-4 text-emerald-600" />
              <AlertTitle className="text-emerald-800">Succes</AlertTitle>
              <AlertDescription className="text-emerald-700">
                Formation creee avec succes !
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-sm font-semibold text-slate-700">Nom *</Label>
              <Input id="name" name="name" value={form.name} onChange={handleChange} placeholder="Ex: Aquaculture intensive" required className="mt-1.5 h-11" />
            </div>

            <div>
              <Label htmlFor="category" className="text-sm font-semibold text-slate-700">Categorie</Label>
              <div className="relative mt-1.5">
                <Input id="category" name="category" value={form.category} onChange={handleChange} onFocus={() => setShowCategorySuggestions(true)} onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 200)} placeholder="Ex: Aquaculture" className="h-11 pr-10" />
                {form.category && (
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, category: "" }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {showCategorySuggestions && (
                <div className="absolute z-10 mt-1 w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-lg p-2">
                  <p className="text-xs text-slate-500 mb-2 px-2">Suggestions :</p>
                  <div className="flex flex-wrap gap-1">
                    {CATEGORIES_SUGGESTIONS.map((cat) => (
                      <button key={cat} type="button" onClick={() => { setForm((prev) => ({ ...prev, category: cat })); setShowCategorySuggestions(false); }} className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-semibold text-slate-700">Description</Label>
              <textarea id="description" name="description" value={form.description} onChange={handleChange} placeholder="Decrivez la formation..." rows={4} className="w-full px-4 py-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1.5 resize-none" />
            </div>

            <div>
              <Label htmlFor="skills" className="text-sm font-semibold text-slate-700">Competences</Label>
              <div className="flex gap-2 mt-1.5">
                <Input id="skills" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ex: Gestion de l'eau" className="h-11" />
                <Button type="button" onClick={handleAddSkill} variant="outline" size="sm" className="gap-2"><Plus className="w-4 h-4" /> Ajouter</Button>
              </div>
              {form.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="bg-blue-100 text-blue-700 gap-2 pr-1">
                      {skill}
                      <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:bg-blue-200 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6 border-t">
              <Link href="/admin/formations"><Button type="button" variant="outline">Annuler</Button></Link>
              <Button type="submit" disabled={loading} className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700">
                {loading ? <><Loader2 className="animate-spin w-4 h-4" /> Creation...</> : <><Check className="w-4 h-4" /> Creer</>}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
