"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Briefcase,
  Send,
  Loader2,
  CheckCircle2,
  MapPin,
  GraduationCap,
  Mail,
  Phone,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function InternshipApplicationPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    university: "",
    level: "",
    position: "",
    cvFile: null as File | null,
    message: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare payload, converting CV file to base64 if present
      const payload = { ...formData } as any;
      if (formData.cvFile) {
        const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
        try {
          const base64 = await toBase64(formData.cvFile);
          payload.cvUrl = base64; // store as base64 string
        } catch (e) {
          toast.error('Erreur de lecture du CV');
          setLoading(false);
          return;
        }
        delete payload.cvFile;
      }
      const res = await fetch("/api/public/internships", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Erreur");

      toast.success("Votre demande a été envoyée !");
      setSubmitted(true);
    } catch {
      toast.error("Échec lors de l'envoi. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 px-6 animate-in fade-in zoom-in duration-700">
        <Card className="p-12 text-center space-y-8 border-none shadow-2xl bg-white rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
          <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
             <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Demande reçue !</h1>
            <p className="text-slate-500 text-lg max-w-md mx-auto leading-relaxed">
              Merci pour l'intérêt que vous portez à la <strong>Ferme Agro-Piscicole Cité St André</strong>. Notre équipe examinera votre profil et vous recontactera très prochainement.
            </p>
          </div>
          <div className="pt-8">
            <Link href="/">
              <Button size="lg" className="h-14 px-12 bg-slate-900 hover:bg-slate-800 font-bold text-lg rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95">
                Retour à l'accueil
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-16 items-start animate-in slide-in-from-bottom-8 duration-700">
      <div className="md:w-1/3 space-y-12">
        <div className="space-y-4">
          <div className="w-16 h-1 bg-emerald-600 rounded-full" />
          <h1 className="text-5xl font-black text-slate-900 leading-none">Postulez pour un Stage</h1>
          <p className="text-xl text-slate-500 leading-relaxed italic">Rejoignez une équipe dynamique et passionnée à la Ferme Agro-Piscicole Cité St André.</p>
        </div>

        <div className="space-y-8">
          <div className="flex gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-500">
                <MapPin className="w-6 h-6" />
             </div>
             <div>
                <h3 className="font-bold text-slate-800">Lieu du stage</h3>
                <p className="text-sm text-slate-500">Ferme Agro-Piscicole Cité St André, Abomey-Calavi, Bénin.</p>
             </div>
          </div>
          <div className="flex gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
                <GraduationCap className="w-6 h-6" />
             </div>
             <div>
                <h3 className="font-bold text-slate-800">Niveau requis</h3>
                <p className="text-sm text-slate-500">Stagiaires de Licence, Master ou formation technique.</p>
             </div>
          </div>
        </div>
      </div>

      <div className="md:w-2/3 w-full">
        <Card className="p-10 border-none shadow-3xl bg-white rounded-[2.5rem] relative">
          <div className="absolute top-10 right-10 flex gap-2">
             <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
             <div className="h-1.5 w-4 bg-slate-100 rounded-full" />
             <div className="h-1.5 w-4 bg-slate-100 rounded-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-10 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor="fullName" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Nom complet</Label>
                <div className="relative">
                  <Input
                    id="fullName"
                    placeholder="Sènou Dossou"
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    required
                    className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-base font-medium shadow-inner"
                  />
                  <div className="absolute top-1/2 right-6 -translate-y-1/2 text-slate-300"><FileText className="w-5 h-5" /></div>
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="email" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="senou.dossou@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-base font-medium shadow-inner"
                  />
                  <div className="absolute top-1/2 right-6 -translate-y-1/2 text-slate-300"><Mail className="w-5 h-5" /></div>
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="phone" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Téléphone</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    placeholder="+229 ..."
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    required
                    className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-base font-medium shadow-inner"
                  />
                  <div className="absolute top-1/2 right-6 -translate-y-1/2 text-slate-300"><Phone className="w-5 h-5" /></div>
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="position" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Poste souhaité</Label>
                <div className="relative">
                  <select
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({...formData, position: e.target.value})}
                    required
                    className="w-full h-14 px-6 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-base font-medium shadow-inner outline-none"
                  >
                    <option value="">Sélectionnez...</option>
                    <option value="Pisciculture">Pisciculture / Aquaculture</option>
                    <option value="Agriculture">Agriculture / Agronomie</option>
                    <option value="Elevage">Élevage / Aviculture</option>
                    <option value="Autre">Autre (Admin, Gestion, Tech)</option>
                  </select>
                  <div className="absolute top-1/2 right-12 -translate-y-1/2 text-slate-300"><Briefcase className="w-5 h-5" /></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                  <Label htmlFor="university" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Université / Établissement</Label>
                  <Input
                    id="university"
                    placeholder="Nom de votre école"
                    value={formData.university}
                    onChange={(e) => setFormData({...formData, university: e.target.value})}
                    className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 text-base font-medium shadow-inner"
                  />
               </div>
               <div className="space-y-3">
                  <Label htmlFor="level" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Niveau d'études</Label>
                  <Input
                    id="level"
                    placeholder="Ex: Master 1"
                    value={formData.level}
                    onChange={(e) => setFormData({...formData, level: e.target.value})}
                    className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 text-base font-medium shadow-inner"
                  />
               </div>
            </div>

            <div className="space-y-3">
               <Label htmlFor="cvFile" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Télécharger votre CV (PDF)</Label>
               <Input
                 id="cvFile"
                 type="file"
                 accept=".pdf"
                 onChange={(e) => {
                   const file = e.target.files?.[0] || null;
                   setFormData({ ...formData, cvFile: file });
                 }}
                 className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 text-base font-medium shadow-inner"
               />
            </div>

            <div className="space-y-3">
               <Label htmlFor="message" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Pourquoi choisir la Ferme St André ?</Label>
               <Textarea
                 id="message"
                 placeholder="Dites-nous en plus sur vos motivations..."
                 value={formData.message}
                 onChange={(e) => setFormData({...formData, message: e.target.value})}
                 className="min-h-[120px] p-6 bg-slate-50 border-none rounded-3xl focus:ring-2 focus:ring-emerald-500/20 text-base font-medium shadow-inner outline-none resize-none"
               />
            </div>

            <div className="flex justify-end pt-4">
               <Button
                type="submit"
                disabled={loading}
                className="h-16 px-12 bg-emerald-600 hover:bg-emerald-700 rounded-3xl font-black text-lg gap-4 shadow-2xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 group"
               >
                 {loading ? <Loader2 className="animate-spin" /> : <Send className="w-6 h-6 group-hover:translate-x-1" />}
                 Envoyer ma demande
               </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
