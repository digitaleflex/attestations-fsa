"use client";

import React from "react";
import { 
  Users, 
  Search, 
  MapPin, 
  ExternalLink, 
  ArrowRight,
  UserCheck,
  Globe,
  Award,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function PortfoliosListPage() {
  const [isWaitlistOpen, setIsWaitlistOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error("Erreur");

      toast.success("Succès !", {
        description: "Vous avez bien rejoint la liste d'attente. Vérifiez vos emails !"
      });
      setIsWaitlistOpen(false);
      setEmail("");
    } catch (err) {
      toast.error("Erreur", {
        description: "Impossible de rejoindre la liste. Réessayez plus tard."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 selection:bg-blue-500/10 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-emerald-500/5 rounded-full blur-[100px] animate-bounce-slow" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Navigation / Hero Top - RETIRÉ */}

        {/* Hero Content */}
        <header className="py-12 md:py-20 text-center space-y-8 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-4 duration-700 shadow-sm">
            <Sparkles className="w-3 h-3" /> Annuaire des Talents FSA
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] text-slate-900 animate-in zoom-in-95 duration-1000">
            L'Excellence <br /> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600">Certifiée Automatisée</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            Découvrez les portfolios numériques vérifiés de nos diplômés. Un accès direct aux compétences techniques validées par la FSA.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <Input 
                placeholder="Rechercher un technicien..." 
                className="pl-12 w-full md:w-[400px] rounded-2xl h-14 bg-white border-slate-200 shadow-xl shadow-slate-100/50 text-slate-900 placeholder:text-slate-400 focus:ring-blue-500/10 focus:border-blue-500/20 transition-all font-medium"
              />
            </div>
            <Button 
                onClick={() => setIsWaitlistOpen(true)}
                size="lg" 
                className="rounded-2xl h-14 px-8 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-wider text-xs shadow-xl shadow-slate-200 transition-all hover:scale-105 active:scale-95"
            >
              Rejoindre la Liste d'Attente
            </Button>
          </div>
        </header>

        {/* Feature Grid with Coming Soon Overlay */}
        <section className="relative py-20">
          {/* Skeleton Cards Background */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pointer-events-none opacity-40">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="group">
                <div className="p-8 rounded-[2.5rem] bg-white border border-slate-100 space-y-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-3/4 bg-slate-100 rounded-full" />
                      <div className="h-2 w-1/2 bg-slate-100 rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 w-full bg-slate-50 rounded-full" />
                    <div className="h-2 w-5/6 bg-slate-50 rounded-full" />
                    <div className="h-2 w-4/6 bg-slate-50 rounded-full" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <div className="h-6 w-16 bg-slate-50 rounded-lg" />
                    <div className="h-6 w-16 bg-slate-50 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Central Glassmorphic Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full max-w-3xl bg-white/70 backdrop-blur-[60px] border border-white p-12 md:p-20 rounded-[4rem] shadow-[0_40px_100px_rgba(0,0,0,0.08)] text-center space-y-10 animate-in zoom-in duration-1000">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30 rotate-12 group-hover:rotate-0 transition-transform duration-500">
                  <Globe className="w-12 h-12 text-white animate-spin-slow" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-white rounded-full animate-ping" />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-white rounded-full shadow-sm" />
              </div>

              <div className="space-y-6">
                <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-slate-900">
                  Portfolios en cours <br /> <span className="text-slate-400 italic">de certification...</span>
                </h2>
                <p className="text-slate-500 text-lg font-medium max-w-lg mx-auto leading-relaxed">
                  Nous finalisons l'intégration automatique des résultats d'examen pour générer des CV numériques infalsifiables reliés à la Blockchain FSA.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <FeatureBox icon={Award} title="Diplômes" label="Validés" color="blue" />
                <FeatureBox icon={UserCheck} title="Identité" label="Vérifiée" color="emerald" />
                <FeatureBox icon={ExternalLink} title="Public" label="Partageable" color="indigo" />
              </div>

              <div className="pt-6">
                <Button 
                    onClick={() => setIsWaitlistOpen(true)}
                    className="w-full h-16 rounded-3xl bg-slate-900 text-white hover:bg-slate-800 font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-slate-200"
                >
                  Me notifier à l'ouverture
                </Button>
                <p className="mt-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                  Plus de 1,200 techniciens déjà pré-enregistrés
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Waitlist Modal */}
        <Dialog open={isWaitlistOpen} onOpenChange={setIsWaitlistOpen}>
          <DialogContent className="sm:max-w-[500px] md:max-w-[600px] sm:rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] gap-6 p-10 bg-white/95 backdrop-blur-3xl overflow-hidden">
             {/* Modal Background Glow */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
             
             <DialogHeader className="relative z-10 text-center sm:text-center space-y-4">
               <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100">
                  <Sparkles className="w-8 h-8" />
               </div>
               <DialogTitle className="text-3xl font-black tracking-tight text-slate-900">
                 Rejoindre l'élite FSA
               </DialogTitle>
               <DialogDescription className="text-slate-500 font-medium text-base">
                 Soyez parmi les premiers à transformer vos attestations en un portfolio numérique certifié et public.
               </DialogDescription>
             </DialogHeader>

             <form onSubmit={handleJoinWaitlist} className="relative z-10 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Adresse email professionnelle</label>
                  <Input 
                    required
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 rounded-2xl border-slate-200 focus:ring-blue-500/10 focus:border-blue-500/20 bg-slate-50/50"
                  />
                </div>
                <Button 
                  disabled={loading}
                  type="submit" 
                  className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "S'inscrire à la liste d'attente"}
                </Button>
                <p className="text-[10px] text-center text-slate-400 font-medium italic">
                  * Confirmation immédiate après inscription.
                </p>
             </form>
          </DialogContent>
        </Dialog>

        {/* Footer Info */}
        <footer className="py-20 text-center border-t border-slate-100">
          <p className="text-slate-400 text-sm font-medium">
            &copy; 2026 Ferme Agro-Piscicole Cité St André. Tous droits réservés. <br />
            Plateforme Technologique d'Excellence.
          </p>
        </footer>
      </div>
    </div>
  );
}

function FeatureBox({ icon: Icon, title, label, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100"
  };

  return (
    <div className="p-4 rounded-3xl bg-white border border-slate-100 space-y-2 group hover:bg-slate-50 transition-all shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto border transition-transform ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-0.5">
        <p className="text-xs font-black uppercase text-slate-800 tracking-widest">{title}</p>
        <p className={`text-[10px] font-bold uppercase ${activeTabColor(color)}`}>{label}</p>
      </div>
    </div>
  )
}

function activeTabColor(color: string) {
    if (color === 'blue') return 'text-blue-500';
    if (color === 'emerald') return 'text-emerald-500';
    return 'text-indigo-500';
}
