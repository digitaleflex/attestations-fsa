"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Settings as SettingsIcon,
  Save,
  Building2,
  UserCircle,
  Target,
  Mail,
  PenLine,
  Image as ImageIcon,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CertificateTemplate from "@/components/CertificateTemplate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Settings = {
  id: string;
  institutionName: string;
  institutionLogo: string | null;
  instructorName: string;
  instructorTitle: string;
  signatureUrl: string | null;
  supportEmail: string;
  replyTo: string | null;
  targetInscriptions: number;
  targetAttestations: number;
  targetValidations: number;
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Settings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // 1. Fetch current settings
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Erreur de récupération");
      return res.json();
    }
  });

  // 2. Map data to form state when loaded
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // 3. Update mutations
  const updateMutation = useMutation({
    mutationFn: async (updatedData: Partial<Settings>) => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: settings?.id, ...updatedData })
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      toast.success("✨ Paramètres institutionnels synchronisés !");
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: () => {
      toast.error("❌ Échec de la mise à jour");
    }
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        await updateMutation.mutateAsync(formData);
    } finally {
        setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  if (isLoading) return (
    <div className="p-20 flex flex-col items-center justify-center gap-4 text-primary">
        <Loader2 className="animate-spin w-12 h-12" />
        <p className="font-bold animate-pulse">Initialisation Système FSA...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-32">

      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-4">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 flex items-center justify-center shadow-2xl shadow-slate-200 ring-4 ring-white">
            <SettingsIcon className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Configuration Générale</h1>
            <p className="text-slate-500 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Gérez l'identité visuelle et les objectifs de performance.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
             <Button
                onClick={() => setShowPreview(!showPreview)}
                variant="outline"
                className={cn(
                    "h-14 px-8 rounded-2xl font-bold gap-3 transition-all border-slate-200 shadow-sm",
                    showPreview && "bg-blue-50 text-blue-600 border-blue-200"
                )}
             >
                <Eye className="w-5 h-5" />
                Démonstration Rendu
             </Button>
             <Button
                onClick={() => setShowConfirm(true)}
                disabled={isSaving}
                className="bg-slate-900 hover:bg-slate-800 text-white gap-3 h-14 px-10 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all"
            >
                {isSaving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5 text-emerald-400" />}
                Mettre à jour FSA
            </Button>
        </div>
      </div>

      {/* Mode Aperçu Dynamique */}
      {showPreview && (
        <div className="relative group animate-in slide-in-from-top-4 duration-500">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
            <Card className="relative p-12 border-none shadow-2xl bg-slate-950 overflow-hidden rounded-[2.5rem]">
                <div className="flex flex-col items-center">
                    <div className="w-full flex items-center justify-between mb-8 text-white/40 px-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Simulation Certificat Officiel v4.2.0</span>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold">TEMPS RÉEL</span>
                        </div>
                    </div>

                    <div className="scale-[0.55] lg:scale-[0.65] origin-top mb-[-320px] lg:mb-[-280px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden border-8 border-white/5">
                        <CertificateTemplate
                            settings={{
                                ...settings,
                                institutionName: formData.institutionName || settings?.institutionName || "",
                                institutionLogo: formData.institutionLogo || settings?.institutionLogo || null,
                                instructorName: formData.instructorName || settings?.instructorName || "",
                                instructorTitle: formData.instructorTitle || settings?.instructorTitle || "",
                                signatureUrl: formData.signatureUrl || settings?.signatureUrl || null
                            } as any}
                            data={{
                                fullName: "TEST-ALPHA CANDIDAT (DÉMO)",
                                formationName: "FORMATION EXPERTE EN AGRO-PISCICULTURE",
                                code: "FSA-SIM-2026-X",
                                issuedAt: new Date().toISOString(),
                                startDate: new Date().toISOString(),
                                endDate: new Date().toISOString(),
                                type: "FORMATION",
                                gender: "M",
                                status: "VALIDATED"
                            }}
                        />
                    </div>
                </div>
            </Card>
        </div>
      )}

      <form className="grid gap-10 lg:grid-cols-2" onSubmit={handleSave}>

        {/* Section 1 : Identité & Contact */}
        <Card className="p-10 border-none shadow-premium bg-white rounded-[2.5rem] space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-700" />

            <div className="flex items-center gap-4 relative z-10 pb-6 border-b border-slate-50">
               <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-100">
                  <Building2 className="w-6 h-6 text-white" />
               </div>
               <div>
                  <h3 className="font-black text-slate-900 text-lg">Identité Institutionnelle</h3>
                  <p className="text-slate-400 text-xs font-medium">Logos et dénominations légales.</p>
               </div>
            </div>

            <div className="space-y-6 relative z-10">
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Dénomination de l'établissement
                        <HelpCircle className="w-3 h-3 text-slate-300" />
                    </label>
                    <Input
                      name="institutionName"
                      value={formData.institutionName || ""}
                      onChange={handleChange}
                      className="bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 h-14 rounded-2xl text-slate-800 font-bold px-6 transition-all shadow-inner"
                    />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Support</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-4.5 w-5 h-5 text-slate-300" />
                            <Input
                              name="supportEmail"
                              type="email"
                              value={formData.supportEmail || ""}
                              onChange={handleChange}
                              className="pl-12 bg-slate-50 border-none h-14 rounded-2xl font-medium shadow-inner"
                            />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo (Ratio 1:1 suggéré)</label>
                        <div className="flex gap-4">
                            <Input
                            name="institutionLogo"
                            value={formData.institutionLogo || ""}
                            onChange={handleChange}
                            placeholder="URL..."
                            className="bg-slate-50 border-none h-14 rounded-2xl font-medium px-5 flex-1 shadow-inner"
                            />
                            {formData.institutionLogo && (
                                <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center p-1 shadow-inner border border-slate-100 flex-shrink-0">
                                    <img src={formData.institutionLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Card>

        {/* Section 2 : Autorité de Signature */}
        <Card className="p-10 border-none shadow-premium bg-white rounded-[2.5rem] space-y-8 relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-emerald-50 rounded-full -mr-20 -mb-20 opacity-40 group-hover:scale-110 transition-transform duration-1000" />

            <div className="flex items-center gap-4 relative z-10 pb-6 border-b border-slate-50">
               <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-100">
                  <UserCircle className="w-6 h-6 text-white" />
               </div>
               <div>
                  <h3 className="font-black text-slate-900 text-lg">Direction Technique</h3>
                  <p className="text-slate-400 text-xs font-medium">Validations du signataire officiel.</p>
               </div>
            </div>

            <div className="space-y-6 relative z-10">
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom du Responsable</label>
                    <Input
                      name="instructorName"
                      value={formData.instructorName || ""}
                      onChange={handleChange}
                      className="bg-slate-50 border-none h-14 rounded-2xl text-slate-800 font-bold px-6 shadow-inner"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titre Officiel</label>
                    <Input
                      name="instructorTitle"
                      value={formData.instructorTitle || ""}
                      onChange={handleChange}
                      className="bg-slate-50 border-none h-14 rounded-2xl font-medium px-6 shadow-inner"
                    />
                </div>

                <div className="space-y-4 pt-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                        Signature (PNG Transparent)
                        <PenLine className="w-3.5 h-3.5 text-emerald-600" />
                    </label>
                    <Input
                        name="signatureUrl"
                        value={formData.signatureUrl || ""}
                        onChange={handleChange}
                        placeholder="Lien vers la signature..."
                        className="bg-slate-50 border-none h-14 rounded-2xl px-6 shadow-inner"
                    />
                    {formData.signatureUrl && (
                        <div className="mt-4 p-6 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2rem] flex items-center justify-center relative overflow-hidden group/sign">
                             <img src={formData.signatureUrl} alt="Signature Preview" className="max-h-24 filter contrast-125" />
                        </div>
                    )}
                </div>
            </div>
        </Card>

        {/* Section 3 : Objectifs Strategiques KPIs */}
        <Card className="p-12 border-none shadow-2xl bg-slate-900 rounded-[3rem] lg:col-span-2 space-y-12 relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.1),transparent)] pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-2xl shadow-amber-500/10 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                        <Target className="w-8 h-8 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="font-black text-white text-2xl tracking-tight">Performances Mensuelles</h3>
                        <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Configuration des indicateurs clefs (KPIs)</p>
                    </div>
                </div>
                <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20 font-mono px-6 h-10 rounded-full tracking-widest">SYNC_ACTIVE_V4</Badge>
            </div>

            <div className="grid md:grid-cols-3 gap-12 relative z-10">
                <div className="space-y-6 group/kpi">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] block ml-4">Inscriptions</label>
                    <div className="relative">
                        <Input
                            name="targetInscriptions"
                            type="number"
                            value={formData.targetInscriptions || 0}
                            onChange={handleChange}
                            className="bg-white/5 border-white/5 h-24 text-5xl font-black text-amber-500 rounded-[2rem] text-center focus:ring-0 focus:border-amber-500/40 transition-all selection:bg-amber-500/30"
                        />
                        <div className="absolute -bottom-1 left-8 right-8 h-1 bg-amber-500/20 rounded-full blur-sm opacity-0 group-hover/kpi:opacity-100 transition-opacity" />
                    </div>
                </div>

                <div className="space-y-6 group/kpi">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] block ml-4">Attestations</label>
                    <div className="relative">
                        <Input
                            name="targetAttestations"
                            type="number"
                            value={formData.targetAttestations || 0}
                            onChange={handleChange}
                            className="bg-white/5 border-white/5 h-24 text-5xl font-black text-blue-400 rounded-[2rem] text-center focus:ring-0 focus:border-blue-500/40 transition-all selection:bg-blue-500/30"
                        />
                        <div className="absolute -bottom-1 left-8 right-8 h-1 bg-blue-500/20 rounded-full blur-sm opacity-0 group-hover/kpi:opacity-100 transition-opacity" />
                    </div>
                </div>

                <div className="space-y-6 group/kpi">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] block ml-4">Validations</label>
                    <div className="relative">
                        <Input
                            name="targetValidations"
                            type="number"
                            value={formData.targetValidations || 0}
                            onChange={handleChange}
                            className="bg-white/5 border-white/5 h-24 text-5xl font-black text-emerald-400 rounded-[2rem] text-center focus:ring-0 focus:border-emerald-500/40 transition-all selection:bg-emerald-500/30"
                        />
                        <div className="absolute -bottom-1 left-8 right-8 h-1 bg-emerald-500/20 rounded-full blur-sm opacity-0 group-hover/kpi:opacity-100 transition-opacity" />
                    </div>
                </div>
            </div>

            <div className="pt-8 border-t border-white/5 flex items-center gap-3 text-white/20 relative z-10 px-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-[11px] font-medium leading-relaxed italic">Ces valeurs servent de référentiel pour calculer les taux de réussite et de conversion affichés sur le Nexus Admin de la FSA.</span>
            </div>
        </Card>
      </form>

      {/* Confirmation Modale Ultra-Design */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-white border-none shadow-2xl rounded-[3rem] max-w-[500px] p-0 overflow-hidden">
          <div className="bg-slate-900 p-12 text-white flex flex-col items-center">
             <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-xl ring-1 ring-white/20">
                <Save className="w-10 h-10 text-emerald-400" />
             </div>
             <AlertDialogTitle className="text-3xl font-black tracking-tight text-center">
                Mise à jour Système
             </AlertDialogTitle>
             <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] mt-2">DÉPLOIEMENT_CONFIG_v4</p>
          </div>

          <div className="p-12 space-y-8">
            <AlertDialogDescription className="text-slate-500 font-medium text-lg text-center leading-relaxed">
                Appliquer ces paramètres modifiera irrémédiablement l'identité visuelle de <span className="text-slate-900 font-bold">tous les futurs documents</span>.
            </AlertDialogDescription>

            <div className="flex gap-4">
                <AlertDialogCancel className="flex-1 h-16 rounded-2xl border-none bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-all">Annuler</AlertDialogCancel>
                <AlertDialogAction
                    onClick={(e) => {
                        e.preventDefault();
                        setShowConfirm(false);
                        handleSave(e as any);
                    }}
                    className="flex-1 h-16 rounded-2xl bg-slate-900 hover:bg-black text-white font-black shadow-2xl gap-3 transition-all"
                    disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirmer"}
                </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
