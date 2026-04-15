"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";

// Helper pour formater la date en français (jj/mm/aaaa)
function formatDateFr(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
}

// Helper pour convertir dd/mm/yyyy vers yyyy-mm-dd pour l'input
function parseDateForInput(dateStr: string): string {
  if (!dateStr || dateStr === "-") return "";
  // Si déjà en format yyyy-mm-dd (input date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Si en format dd/mm/yyyy
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return "";
}

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, User, Mail, Phone, MapPin, Calendar, Lock, Save, Share2, Copy, ExternalLink, Globe, Check, CheckCircle2, ShieldCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CorrectionModal } from "@/components/CorrectionModal";

import { Switch } from "@/components/ui/switch";

export default function UserProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [copied, setCopied] = useState(false);

  // États de Correction
  const [correctionField, setCorrectionField] = useState<{ field: string, label: string } | null>(null);
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const { data: user, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        if (res.status === 401) router.push("/auth");
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    birthDate: "",
    birthPlace: "",
    newPassword: "",
    confirmPassword: "",
    oldPassword: "",
    portfolioEnabled: false,
    portfolioSlug: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
        birthDate: user.birthDate || "",
        birthPlace: user.birthPlace || "",
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
        portfolioEnabled: user.portfolioEnabled || false,
        portfolioSlug: user.portfolioSlug || "",
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setIsEditing(false);
      toast.success("Profil mis à jour avec succès !");
    },
    onError: (error: any) => toast.error(error.message || "Erreur lors de la mise à jour"),
  });

  const correctionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/user/profile/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setCorrectionField(null);
      toast.success("Demande de correction envoyée !");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showPasswordForm) {
      if (form.newPassword !== form.confirmPassword) return toast.error("Les mots de passe ne correspondent pas");
      updateMutation.mutate({ oldPassword: form.oldPassword, newPassword: form.newPassword });
    } else {
      updateMutation.mutate({
        name: form.name, email: form.email, phone: form.phone,
        address: form.address, birthDate: form.birthDate, birthPlace: form.birthPlace,
        portfolioEnabled: form.portfolioEnabled
      });
    }
  };

  const copyLink = () => {
    const url = `${window.location.protocol}//${window.location.host}/p/${form.portfolioSlug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* En-tête */}
      <Card className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
            <User className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">{user?.name}</h2>
            <p className="text-blue-100 opacity-80">{user?.email}</p>
            <Badge className="mt-3 bg-white/20 hover:bg-white/30 border-none px-3 py-1">Candidat FSA</Badge>
          </div>
        </div>
      </Card>

      {/* Formulaire Informations Personnelles */}
      <Card className="p-8 bg-white shadow-md border-slate-100 relative overflow-hidden">
        <div className="flex items-center justify-between mb-8 border-b pb-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <User className="w-6 h-6 text-blue-600" />
            Détails du Profil
          </h3>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>Modifier</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>Annuler</Button>
                <Button onClick={handleSubmit} disabled={updateMutation.isPending} className="bg-blue-600 shadow-lg shadow-blue-200">
                  <Save className="w-4 h-4 mr-2" /> Enregistrer
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <ProfileField
            label="Nom complet" value={form.name} id="name" icon={User}
            isEditing={isEditing}
            onChange={(v: string) => setForm({...form, name: v})}
            onCorrection={() => { setCorrectionField({ field: "fullName", label: "Nom complet" }); setCorrectionValue(form.name); }}
          />
          <ProfileField
            label="Email" value={form.email} id="email" icon={Mail}
            isEditing={isEditing}
            onChange={(v: string) => setForm({...form, email: v})}
          />
          <ProfileField
            label="Téléphone" value={form.phone} id="phone" icon={Phone}
            isEditing={isEditing}
            onChange={(v: string) => setForm({...form, phone: v})}
          />
          <ProfileField
            label="Adresse" value={form.address} id="address" icon={MapPin}
            isEditing={isEditing}
            onChange={(v: string) => setForm({...form, address: v})}
          />
          <ProfileField
            label="Date de naissance" value={form.birthDate} id="birthDate" icon={Calendar}
            isEditing={isEditing} type="date"
            onChange={(v: string) => setForm({...form, birthDate: v})}
            onCorrection={() => { setCorrectionField({ field: "birthDate", label: "Date de naissance" }); setCorrectionValue(form.birthDate); }}
          />
          <ProfileField
            label="Lieu de naissance" value={form.birthPlace} id="birthPlace" icon={MapPin}
            isEditing={isEditing}
            onChange={(v: string) => setForm({...form, birthPlace: v})}
            onCorrection={() => { setCorrectionField({ field: "birthPlace", label: "Lieu de naissance" }); setCorrectionValue(form.birthPlace); }}
          />
        </div>
      </Card>

      {/* Section Sécurité */}
      <Card className="p-8 bg-white shadow-md border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Lock className="w-6 h-6 text-indigo-600" /> Sécurité & Mot de passe
          </h3>
          <Button variant="outline" onClick={() => setShowPasswordForm(!showPasswordForm)}>
            {showPasswordForm ? "Masquer" : "Changer mon mot de passe"}
          </Button>
        </div>

        {showPasswordForm ? (
          <form className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-top-2 duration-300">
             <div className="space-y-4">
                <Label>Ancien mot de passe</Label>
                <Input type="password" value={form.oldPassword} onChange={e => setForm({...form, oldPassword: e.target.value})} className="h-11" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nouveau mot de passe</Label>
                    <Input type="password" value={form.newPassword} onChange={e => setForm({...form, newPassword: e.target.value})} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmer</Label>
                    <Input type="password" value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} className="h-11" />
                  </div>
                </div>
             </div>
             <Button onClick={handleSubmit} disabled={updateMutation.isPending} className="w-full h-11 bg-indigo-600">
               {updateMutation.isPending ? "Modification..." : "Mettre à jour le mot de passe"}
             </Button>
          </form>
        ) : (
          <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-4 text-slate-600 border border-slate-100 italic">
            <Lock className="w-5 h-5 text-slate-400" /> Vos accès sont protégés de bout en bout.
          </div>
        )}
      </Card>
      
      {/* Section Portfolio */}
      <Card className="p-8 bg-white shadow-md border-slate-100 overflow-hidden relative group">
         <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-0 opacity-0 group-hover:opacity-100 transition-opacity" />
         <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-6 h-6 text-emerald-600" /> Portfolio Professionnel Verifié
              </h3>
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Public</span>
                 <Switch 
                   checked={form.portfolioEnabled} 
                   onCheckedChange={(checked) => {
                     setForm({...form, portfolioEnabled: checked});
                     updateMutation.mutate({ portfolioEnabled: checked });
                   }} 
                 />
              </div>
            </div>

            {form.portfolioEnabled ? (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                 <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1">
                       <p className="text-sm font-bold text-slate-700 mb-1 tracking-tight">Votre lien de vitrine professionnelle</p>
                       <p className="text-xs text-slate-400 font-medium italic">Partagez ce lien sur votre CV ou LinkedIn pour prouver vos diplômes.</p>
                       <div className="mt-4 flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
                          <code className="text-[10px] md:text-xs font-mono text-emerald-700 flex-1 truncate px-2">
                             {typeof window !== 'undefined' ? `${window.location.host}/p/${form.portfolioSlug}` : `.../p/${form.portfolioSlug}`}
                          </code>
                          <Button variant="ghost" size="sm" onClick={copyLink} className="h-8 gap-2 rounded-lg font-bold text-[10px] uppercase tracking-widest text-emerald-600 hover:bg-emerald-100 shrink-0">
                             {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                             {copied ? "Copié" : "Copier"}
                          </Button>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <Link href={`/p/${form.portfolioSlug}`} target="_blank">
                          <Button className="h-12 px-6 rounded-xl bg-slate-900 shadow-lg shadow-slate-200 gap-2">
                             <ExternalLink className="w-4 h-4" /> Voir ma vitrine
                          </Button>
                       </Link>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center space-y-2">
                       <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Certifié</p>
                    </div>
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center space-y-2">
                       <Share2 className="w-6 h-6 text-blue-500 mx-auto" />
                       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Partageable</p>
                    </div>
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center space-y-2">
                       <ShieldCheck className="w-6 h-6 text-indigo-500 mx-auto" />
                       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Authentique</p>
                    </div>
                 </div>
              </div>
            ) : (
              <div className="p-10 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                 <Globe className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                 <h4 className="text-slate-800 font-bold mb-1">Votre visibilité est désactivée</h4>
                 <p className="text-sm text-slate-400 max-w-sm mx-auto">Activez votre portfolio pour permettre l&apos;affichage public de vos attestations et booster votre employabilité.</p>
              </div>
            )}
         </div>
      </Card>

      <CorrectionModal
        field={correctionField}
        value={correctionValue}
        reason={correctionReason}
        onValueChange={setCorrectionValue}
        onReasonChange={setCorrectionReason}
        onClose={() => setCorrectionField(null)}
        onSubmit={() => correctionMutation.mutate({
          field: correctionField?.field, newValue: correctionValue,
          reason: correctionReason, attestationId: user?.attestations?.[0]?.id
        })}
        isPending={correctionMutation.isPending}
      />
    </div>
  );
}

// Sous-composant pour les champs du profil (lisibilité)
interface ProfileFieldProps {
  label: string;
  value: string;
  id: string;
  icon: any;
  isEditing: boolean;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  onCorrection?: () => void;
}

import { DateInput } from "@/components/ui/date-input";

function ProfileField({ label, value, id, icon: Icon, isEditing, onChange, type = "text", placeholder, onCorrection }: ProfileFieldProps) {
  const displayValue = type === "date" && !isEditing ? formatDateFr(value) : value;
  const inputValue = type === "date" && isEditing ? parseDateForInput(value) : value;
  
  return (
    <div className="space-y-1.5 transition-all duration-200">
      <Label htmlFor={id} className="text-sm font-semibold text-slate-600 flex items-center gap-1.5 ml-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </Label>
      <div className="flex gap-2 items-center group">
        {type === "date" && isEditing ? (
          <DateInput
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 flex-1 bg-white border-blue-200 ring-blue-100 rounded-xl"
          />
        ) : (
          <Input
            id={id} 
            type={isEditing ? type : "text"} 
            value={isEditing ? inputValue : displayValue}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isEditing}
            className={`h-11 flex-1 transition-colors ${!isEditing ? "bg-slate-50/50 border-transparent text-slate-800 font-medium" : "bg-white border-blue-200 ring-blue-100"}`}
          />
        )}
        {!isEditing && onCorrection && (
          <Button
            variant="ghost" size="icon"
            className="w-11 h-11 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
            onClick={onCorrection}
            title="Signaler une erreur sur ce champ"
          >
            <AlertCircle className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
