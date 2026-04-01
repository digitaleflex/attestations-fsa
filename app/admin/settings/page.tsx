"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Building, Image, Mail, Target, CheckCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";

export default function AdminSettingsPage() {
  const [form, setForm] = useState({
    institutionName: "",
    logoUrl: "",
    replyTo: "",
    targetInscriptions: 100,
    targetAttestations: 50,
    targetValidations: 75,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        institutionName: settings.institutionName || "",
        logoUrl: settings.logoUrl || "",
        replyTo: settings.replyTo || "",
        targetInscriptions: settings.targetInscriptions ?? 100,
        targetAttestations: settings.targetAttestations ?? 50,
        targetValidations: settings.targetValidations ?? 75,
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Erreur lors de l'enregistrement");

      setSuccess(true);
      toast.success("Paramètres enregistrés !");
    } catch (err: any) {
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">⚙️ Paramètres</h1>
            <p className="text-slate-500 mt-1">Configurez l'application</p>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations de l'institution */}
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <Building className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-slate-800">Informations de l'institution</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="institutionName" className="text-sm font-semibold text-slate-700">
                  🏢 Nom de l'institution
                </Label>
                <div className="relative mt-1">
                  <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input
                    id="institutionName"
                    value={form.institutionName}
                    onChange={(e) => setForm((prev) => ({ ...prev, institutionName: e.target.value }))}
                    placeholder="Ferme St André"
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="logoUrl" className="text-sm font-semibold text-slate-700">
                  🖼️ URL du logo
                </Label>
                <div className="relative mt-1">
                  <Image className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input
                    id="logoUrl"
                    value={form.logoUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://..."
                    className="pl-10 h-11"
                  />
                </div>
                {form.logoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <p className="text-xs text-slate-500">Aperçu :</p>
                    <img src={form.logoUrl} alt="Logo" className="h-10 w-auto rounded border" />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="replyTo" className="text-sm font-semibold text-slate-700">
                  📧 Email de réponse
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input
                    id="replyTo"
                    type="email"
                    value={form.replyTo}
                    onChange={(e) => setForm((prev) => ({ ...prev, replyTo: e.target.value }))}
                    placeholder="contact@fsa.bj"
                    className="pl-10 h-11"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Objectifs */}
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <Target className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-slate-800">Objectifs mensuels</h2>
            </div>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="targetInscriptions" className="text-sm font-semibold text-slate-700">
                    📈 Inscriptions cibles
                  </Label>
                  <Badge variant="secondary" className="text-sm">
                    {form.targetInscriptions}
                  </Badge>
                </div>
                <Input
                  id="targetInscriptions"
                  type="range"
                  min="0"
                  max="500"
                  step="10"
                  value={form.targetInscriptions}
                  onChange={(e) => setForm((prev) => ({ ...prev, targetInscriptions: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <Progress value={(form.targetInscriptions / 500) * 100} className="h-2 mt-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="targetAttestations" className="text-sm font-semibold text-slate-700">
                    📜 Attestations cibles
                  </Label>
                  <Badge variant="secondary" className="text-sm">
                    {form.targetAttestations}
                  </Badge>
                </div>
                <Input
                  id="targetAttestations"
                  type="range"
                  min="0"
                  max="200"
                  step="5"
                  value={form.targetAttestations}
                  onChange={(e) => setForm((prev) => ({ ...prev, targetAttestations: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <Progress value={(form.targetAttestations / 200) * 100} className="h-2 mt-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="targetValidations" className="text-sm font-semibold text-slate-700">
                    ✅ Validations cibles
                  </Label>
                  <Badge variant="secondary" className="text-sm">
                    {form.targetValidations}
                  </Badge>
                </div>
                <Input
                  id="targetValidations"
                  type="range"
                  min="0"
                  max="200"
                  step="5"
                  value={form.targetValidations}
                  onChange={(e) => setForm((prev) => ({ ...prev, targetValidations: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <Progress value={(form.targetValidations / 200) * 100} className="h-2 mt-2" />
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            {success && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-2">
                <CheckCircle className="w-3 h-3" />
                Paramètres enregistrés !
              </Badge>
            )}
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
                  Enregistrer les paramètres
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
