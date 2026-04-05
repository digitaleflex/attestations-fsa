import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle,
  ClipboardCheck,
  Briefcase,
  Sprout,
  ChevronRight,
  GraduationCap,
  Award
} from "lucide-react";

import { getPublicStats } from "@/lib/data-public";
import { StatsDisplay } from '@/components/stats-display';
import { Card } from "@/components/ui/card";
import { HowItWorks } from '@/components/how-it-works';
import { QuickAccessCards } from '@/components/quick-access-cards';
import { FaqSection } from '@/components/faq-section';
import { TypewriterHero } from '@/components/TypewriterHero';
import { FeaturesGrid } from '@/components/features-grid';
import { UpcomingExams } from '@/components/upcoming-exams';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const stats = await getPublicStats();

  const heroMessages = [
    "Inscrivez-vous et passez vos examens en toute simplicité.",
    "Vérifiez instantanément l'authenticité d'une attestation.",
    "Un espace personnalisé pour suivre votre parcours.",
    "Des certifications reconnues et sécurisées au Bénin.",
    "Accessible partout • Résultats rapides • Certificats authentiques"
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full space-y-0 pb-24 relative">

      {/* --- HERO SECTION --- */}
      <section className="relative w-full min-h-[75vh] flex flex-col items-center justify-center text-center overflow-hidden pt-20 md:pt-24 px-4 pb-12">
        {/* Parallax Background */}
        <div
          className="absolute inset-0 z-0 bg-[url('/images/hero-bg.png')] bg-cover bg-center bg-fixed opacity-[0.08] pointer-events-none transition-transform duration-700"
          aria-hidden="true"
        />
        {/* Subtle Gradient Overlays for Readability */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white to-transparent z-0 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent z-0 pointer-events-none" />

        <div className="relative z-10 max-w-6xl w-full space-y-6">
           <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-emerald-100 backdrop-blur-sm border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-[0.3em] shadow-lg">
              <Sprout className="w-4 h-4 text-emerald-600" />
              FSA Bénin • Plateforme de Certification
           </div>

           <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 tracking-tight sm:tracking-tighter leading-[0.95] md:leading-[1.05] lg:max-w-6xl mx-auto px-4">
              Passez vos examens FSA en ligne. <br />
              Obtenez votre <span className="text-emerald-600">attestation</span> <span className="text-blue-600">instantanément.</span>
           </h1>

           <TypewriterHero messages={heroMessages} />

           <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
                <Link href="/auth">
                    <button className="px-10 py-5 rounded-2xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 shadow-lg shadow-emerald-200">
                        Accéder à mon espace
                        <ArrowRight className="w-5 h-5 ml-2 inline-block" />
                    </button>
                </Link>
                <Link href="/formations">
                   <button className="px-10 py-5 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 font-bold text-base hover:border-emerald-500 hover:text-emerald-600 transition-all hover:-translate-y-1 shadow-sm">
                        Explorer nos formations
                   </button>
                </Link>
           </div>
        </div>
      </section>

      {/* --- FEATURED FORMATIONS PREVIEW --- */}
      <section className="w-full max-w-7xl px-4 py-20">
         <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6">
            <div className="max-w-2xl">
               <Badge className="bg-emerald-100 text-emerald-700 border-none px-4 py-1.5 text-[10px] font-black tracking-widest uppercase mb-4">
                  Expertise Technique
               </Badge>
               <h2 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight">
                  Formations de pointe en <br />
                  <span className="text-emerald-600">Agro-pisciculture.</span>
               </h2>
            </div>
            <Link href="/formations">
               <Button variant="ghost" className="text-emerald-600 font-black gap-2 hover:bg-emerald-50 rounded-xl px-6 h-14">
                  Voir tout le catalogue
                  <ChevronRight className="w-5 h-5" />
               </Button>
            </Link>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
               { icon: Sprout, title: "Formation de base", category: "Pisciculture", color: "bg-emerald-500" },
               { icon: GraduationCap, title: "Production d’alevins", category: "Technique", color: "bg-blue-500" },
               { icon: Award, title: "Pisciculture intensive", category: "Expertise", color: "bg-amber-500" }
            ].map((f, i) => (
               <Card key={i} className="group p-8 rounded-[2.5rem] bg-white border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-emerald-900/5 transition-all duration-500">
                  <div className={`w-14 h-14 rounded-2xl ${f.color} text-white flex items-center justify-center mb-6 shadow-lg shadow-emerald-200 transform group-hover:rotate-6 transition-transform`}>
                     <f.icon className="w-7 h-7" />
                  </div>
                  <Badge variant="secondary" className="mb-3 bg-emerald-50 text-emerald-600 border-none font-bold">
                     {f.category}
                  </Badge>
                  <h3 className="text-xl font-black text-slate-800 mb-4">{f.title}</h3>
                  <Link href="/formations">
                     <Button variant="link" className="p-0 text-emerald-600 font-bold h-auto hover:no-underline group/link">
                        Découvrir le programme
                        <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/link:translate-x-1" />
                     </Button>
                  </Link>
               </Card>
            ))}
         </div>
      </section>

      {/* --- QUICK ACCESS CARDS --- */}
      <QuickAccessCards />

      {/* --- STATS SECTION - Social Proof --- */}
      <section className="w-full px-4">
        <StatsDisplay initialData={stats} />
      </section>

      {/* --- HOW IT WORKS --- */}
      <section className="w-full max-w-7xl px-4">
        <HowItWorks />
      </section>

      {/* --- FEATURES GRID --- */}
      <FeaturesGrid />

      {/* --- UPCOMING EXAMS --- */}
      <UpcomingExams />

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

      {/* --- FAQ SECTION - Handle Objections --- */}
      <section className="w-full max-w-7xl px-4">
        <FaqSection />
      </section>
    </div>
  );
}
