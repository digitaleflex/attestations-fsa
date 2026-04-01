"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Save, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

export default function EditFormationPage() {
  const router = useRouter();
  const { id } = useParams();
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

  const { data: formation, isLoading } = useQuery({
    queryKey: ["formation", id],
    queryFn: async () => {
      const res = await fetch(`/api/formations/${id}`);
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (formation) {
      setForm({
        name: formation.name || "",
        category: formation.category || "",
        description: formation.description || "",
        skills: formation.skills || [],
      });
    }
  }, [formation]);

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
      const res = await fetch(`/api/formations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Erreur lors de la modification");

      setSuccess(true);
      toast.success("Formation modifiée avec succès !");
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
      toast.error(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/formations">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">✏️ Modifier la formation</h1>
              <p className="text-sm text-slate-500">{formation?.name}</p>
            </div>
          </div>
        </div>

        {/* Alertes */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <AlertTitle className="text-emerald-800">Succès</AlertTitle>
            <AlertDescription className="text-emerald-700">
              Formation modifiée avec succès !
            </AlertDescription>
          </Alert>
        )}

        {/* Formulaire */}
        <Card className="p-8 bg-white shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nom */}
            <div>
              <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                📚 Nom de la formation
              </Label>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1.5 h-11"
                required
              />
            </div>

            {/* Catégorie */}
            <div>
              <Label htmlFor="category" className="text-sm font-semibold text-slate-700">
                🏷️ Catégorie
              </Label>
              <Input
                id="category"
                name="category"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="mt-1.5 h-11"
                placeholder="Ex: Aquaculture"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-sm font-semibold text-slate-700">
                📝 Description
              </Label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-4 py-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Compétences */}
            <div>
              <Label htmlFor="skills" className="text-sm font-semibold text-slate-700">
                ⭐ Compétences acquises
              </Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ajouter une compétence"
                  className="h-11"
                />
                <Button
                  type="button"
                  onClick={handleAddSkill}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  Ajouter
                </Button>
              </div>

              {/* Tags de compétences */}
              {form.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="bg-blue-100 text-blue-700 gap-2 pr-1"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Appuyez sur Entrée pour ajouter une compétence
              </p>
            </div>

            {/* Preview */}
            {form.name && (
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">👁️ Aperçu</h3>
                <Card className="p-4 bg-slate-50 border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">🎓</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-800">{form.name}</h4>
                        {form.category && (
                          <Badge variant="outline" className="text-xs">
                            {form.category}
                          </Badge>
                        )}
                      </div>
                      {form.description && (
                        <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                          {form.description}
                        </p>
                      )}
                      {form.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {form.skills.slice(0, 3).map((skill, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {form.skills.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{form.skills.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-6 border-t">
              <Link href="/admin/formations">
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
                    <Loader2 className="animate-spin w-4 h-4" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Enregistrer les modifications
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
