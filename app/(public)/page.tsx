import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle,
  ClipboardCheck,
  Briefcase,
  Sprout,
  ChevronRight
} from "lucide-react";

import { StatsDisplay } from '@/components/stats-display';
import { HowItWorks } from '@/components/how-it-works';
import { QuickAccessCards } from '@/components/quick-access-cards';
import { FaqSection } from '@/components/faq-section';
import { TypewriterHero } from '@/components/TypewriterHero';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  const heroMessages = [
    "Menez votre propre exploitation en Pisciculture Moderne.",
    "Cultiver la terre avec une Agriculture Innovante et Durable.",
    "Maîtriser l'Élevage de pointe et l'Innovation Agro-piscicole.",
    "Rejoignez l'élite des entrepreneurs agricoles au Bénin.",
    "Bâtissons ensemble l'avenir de l'autosuffisance alimentaire."
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full space-y-0 pb-24 relative">

      {/* --- HERO SECTION --- */}
      <section className="relative w-full min-h-[65vh] flex flex-col items-center justify-center text-center overflow-hidden pt-20 md:pt-24 px-4 pb-12">

        <div className="max-w-6xl w-full space-y-6">
           <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-emerald-100 backdrop-blur-sm border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-[0.3em] shadow-lg">
              <Sprout className="w-4 h-4 text-emerald-600" />
              Bénin • Excellence Agricole
           </div>

           <h1 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[1.05] lg:max-w-4xl mx-auto">
              L'Excellence au Confluent <br />
              de la <span className="text-emerald-600">Terre</span> et de <span className="text-blue-600">l'Eau.</span>
           </h1>

           <TypewriterHero messages={heroMessages} />

           <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
                <Link href="/auth">
                    <button className="px-10 py-5 rounded-2xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 shadow-lg shadow-emerald-200">
                        Commencer ma carrière
                        <ArrowRight className="w-5 h-5 ml-2 inline-block" />
                    </button>
                </Link>
                <Link href="/verifier">
                   <button className="px-10 py-5 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 font-bold text-base hover:border-emerald-500 hover:text-emerald-600 transition-all hover:-translate-y-1 shadow-sm">
                        Vérifier un code
                   </button>
                </Link>
           </div>
        </div>
      </section>

      {/* --- QUICK ACCESS CARDS --- */}
      <QuickAccessCards />

      {/* --- STATS SECTION - RETIRÉ --- */}

      {/* --- HOW IT WORKS --- */}
      <section className="w-full max-w-7xl px-4">
        <HowItWorks />
      </section>

      {/* --- CTA SECTION (Pre-footer) --- */}
      <section className="w-full max-w-7xl px-4 md:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl md:rounded-[2.5rem] bg-slate-900 px-6 py-12 md:px-8 md:py-20 text-center shadow-2xl">
          {/* Background Decorative Rings */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-[100px]" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-blue-500/10 blur-[100px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-4 py-1.5 text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase">
              Prêt pour l'aventure ?
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black text-white leading-[1.2] md:leading-[1.1] tracking-tight">
              Rejoignez l'élite de <br className="hidden md:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">l'Agro-pisciculture.</span>
            </h2>
            <p className="text-slate-400 font-medium text-base md:text-lg leading-relaxed max-w-lg mx-auto">
              Ne manquez pas l'opportunité de transformer votre passion en expertise reconnue au Bénin et au-delà.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/auth" className="w-full sm:w-auto">
                <Button size="lg" className="w-full h-14 md:h-16 px-10 rounded-2xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition-all shadow-xl shadow-white/5 active:scale-95 text-base">
                  Créer mon compte
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/faq" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full h-14 md:h-16 px-10 rounded-2xl border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10 transition-all text-base font-bold">
                  En savoir plus
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
