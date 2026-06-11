import Link from "next/link";
import {
  ArrowRight,
  Sprout
} from "lucide-react";

import { getPublicStats } from "@/lib/data-public";
import { StatsDisplay } from '@/components/stats-display';
import { HowItWorks } from '@/components/how-it-works';
import { QuickAccessCards } from '@/components/quick-access-cards';
import { FaqSection } from '@/components/faq-section';
import { UpcomingExams } from '@/components/upcoming-exams';

export default async function Home() {
  const stats = await getPublicStats();

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full space-y-0 pb-24 relative bg-white">

      {/* --- HERO SECTION --- */}
      <section className="relative w-full min-h-[65vh] flex flex-col items-center justify-center text-center overflow-hidden pt-20 md:pt-24 px-4 pb-12">
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
              FSA Bénin • Portail Officiel
           </div>

           <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 tracking-tight sm:tracking-tighter leading-[0.95] md:leading-[1.05] lg:max-w-6xl mx-auto px-4">
              Passez vos examens FSA en ligne. <br />
              Obtenez votre <span className="text-emerald-600">attestation</span> <span className="text-blue-600">instantanément.</span>
           </h1>

           <p className="text-slate-500 font-bold text-base md:text-lg max-w-2xl mx-auto leading-relaxed px-4">
             Espace d'évaluation officiel de la Ferme Cité St André. Connectez-vous à votre espace personnel pour composer vos examens ou valider instantanément l'authenticité d'un certificat.
           </p>

           <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
                 <Link href="/auth">
                     <button className="px-10 py-5 rounded-2xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2">
                         Accéder à mon espace
                         <ArrowRight className="w-5 h-5" />
                     </button>
                 </Link>
           </div>
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

      {/* --- UPCOMING EXAMS --- */}
      <UpcomingExams />

      {/* --- FAQ SECTION - Handle Objections --- */}
      <section className="w-full max-w-7xl px-4">
        <FaqSection />
      </section>
    </div>
  );
}
