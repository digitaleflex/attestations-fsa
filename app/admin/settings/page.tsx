"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Eye
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
      toast.success("✅ Paramètres mis à jour !");
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

  if (isLoading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-xl shadow-slate-200">
            <SettingsIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configuration Générale</h1>
            <p className="text-slate-500 font-medium">Personnalisez l'identité de votre établissement et vos objectifs.</p>
          </div>
        </div>
        <Button 
          onClick={() => setShowConfirm(true)} 
          disabled={isSaving} 
          size="lg" 
          className="bg-slate-900 hover:bg-slate-800 gap-2 h-14 px-8 shadow-xl hover:shadow-2xl transition-all"
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
          Enregistrer les modifications
        </Button>
      </div>

      {/* Real-time Preview Toggle */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Eye className="w-5 h-5" />
            </div>
            <div>
                <p className="text-sm font-bold text-slate-800">Aperçu en temps réel</p>
                <p className="text-xs text-slate-500">Visualisez les changements sur le certificat officiel</p>
            </div>
        </div>
        <Button 
            variant={showPreview ? "default" : "outline"}
            onClick={() => setShowPreview(!showPreview)}
            className={showPreview ? "bg-blue-600 hover:bg-blue-700" : "border-slate-200"}
        >
            {showPreview ? "Masquer l'aperçu" : "Afficher l'aperçu"}
        </Button>
      </div>

      {showPreview && (
        <Card className="p-10 border-none shadow-2xl bg-slate-900 overflow-hidden animate-in slide-in-from-top-4 duration-500">
             <div className="flex justify-center">
                <div className="scale-[0.55] origin-top mb-[-340px] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden">
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
                            fullName: "JEAN DUPONT (EXEMPLE)",
                            formationName: "FORMATION EN AGRO-PISCICULTURE (EXEMPLE)",
                            code: "FSA-2026-M04-00123-abcde",
                            issuedAt: new Date().toISOString(),
                            startDate: new Date().toISOString(),
                            endDate: new Date().toISOString(),
                            type: "FORMATION"
                        }}
                    />
                </div>
             </div>
        </Card>
      )}

      <form className="grid gap-10 lg:grid-cols-2" onSubmit={handleSave}>
        
        {/* Identité de l'institution */}
        <Card className="p-8 border-none shadow-premium bg-white space-y-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
               <Building2 className="w-5 h-5 text-blue-600" />
               <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Identité de l'institution</h3>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom de l'établissement</label>
                    <Input 
                      name="institutionName"
                      value={formData.institutionName || ""}
                      onChange={handleChange}
                      className="bg-slate-50 border-slate-100 h-12 font-medium"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email de contact (Support)</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                        <Input 
                          name="supportEmail"
                          type="email"
                          value={formData.supportEmail || ""}
                          onChange={handleChange}
                          className="pl-10 bg-slate-50 border-slate-100 h-12"
                        />
                    </div>
                </div>

                <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo (URL)</label>
                    <div className="relative">
                        <ImageIcon className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                        <Input 
                          name="institutionLogo"
                          value={formData.institutionLogo || ""}
                          onChange={handleChange}
                          placeholder="https://..."
                          className="pl-10 bg-slate-50 border-slate-100 h-12"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 italic">Utilisé dans le header des emails et sur les PDFs.</p>
                </div>
            </div>
        </Card>

        {/* Autorité de Certification */}
        <Card className="p-8 border-none shadow-premium bg-white space-y-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
               <UserCircle className="w-5 h-5 text-emerald-600" />
               <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Autorité de Certification</h3>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom du Signataire</label>
                    <Input 
                      name="instructorName"
                      value={formData.instructorName || ""}
                      onChange={handleChange}
                      className="bg-slate-50 border-slate-100 h-12 font-bold"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titre / Fonction</label>
                    <Input 
                      name="instructorTitle"
                      value={formData.instructorTitle || ""}
                      onChange={handleChange}
                      className="bg-slate-50 border-slate-100 h-12"
                    />
                </div>

                <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signature Numérisée (URL)</label>
                    <div className="relative">
                        <PenLine className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                        <Input 
                          name="signatureUrl"
                          value={formData.signatureUrl || ""}
                          onChange={handleChange}
                          placeholder="URL de l'image de votre signature"
                          className="pl-10 bg-slate-50 border-slate-100 h-12"
                        />
                    </div>
                    {formData.signatureUrl && (
                        <div className="mt-4 p-4 bg-slate-50 border border-dashed rounded-xl flex items-center justify-center">
                            <img src={formData.signatureUrl} alt="Signature Preview" className="max-h-20" />
                        </div>
                    )}
                </div>
            </div>
        </Card>

        {/* Objectifs KPIs (Dashboard) */}
        <Card className="p-8 border-none shadow-premium bg-white lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-amber-600" />
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Objectifs de performance mensuels</h3>
                </div>
                <div className="text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-tighter">KPIs V4 Ready</div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cible Inscriptions</label>
                    <Input 
                      name="targetInscriptions"
                      type="number"
                      value={formData.targetInscriptions || 0}
                      onChange={handleChange}
                      className="bg-slate-50 border-slate-100 h-14 text-2xl font-black text-amber-600"
                    />
                    <p className="text-xs text-slate-400">Nombre d'inscriptions visées chaque mois.</p>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cible Attestations</label>
                    <Input 
                      name="targetAttestations"
                      type="number"
                      value={formData.targetAttestations || 0}
                      onChange={handleChange}
                      className="bg-slate-50 border-slate-100 h-14 text-2xl font-black text-blue-600"
                    />
                    <p className="text-xs text-slate-400">Attestations prévues de délivrer.</p>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cible Examens Validés</label>
                    <Input 
                      name="targetValidations"
                      type="number"
                      value={formData.targetValidations || 0}
                      onChange={handleChange}
                      className="bg-slate-50 border-slate-100 h-14 text-2xl font-black text-emerald-600"
                    />
                    <p className="text-xs text-slate-400">Total de réussites aux examens visé.</p>
                </div>
            </div>
        </Card>
      </form>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl max-w-[450px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-900 font-bold text-xl">
              <Save className="w-6 h-6 text-blue-600" />
              Confirmer les modifications ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
                Ces changements affecteront l'apparence de <span className="font-bold text-slate-900">toutes les nouvelles attestations</span> ainsi que le branding du portail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel 
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setShowConfirm(false);
                handleSave(e as any);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 gap-2 px-6"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calcul...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Appliquer les changements
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
