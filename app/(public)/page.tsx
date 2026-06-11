import Link from "next/link";
import {
  ArrowRight,
  Sprout
} from "lucide-react";

import { HowItWorks } from '@/components/how-it-works';
import { QuickAccessCards } from '@/components/quick-access-cards';
import { FaqSection } from '@/components/faq-section';
import { UpcomingExams } from '@/components/upcoming-exams';

export default async function Home() {

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full space-y-0 pb-24 relative bg-white">

      {/* --- HERO SECTION --- */}
      <section className="relative w-full min-h-[65vh] flex flex-col items-center justify-center text-center overflow-hidden pt-20 md:pt-24 px-4 pb-12">


        <div className="relative z-10 max-w-6xl w-full space-y-6">
           <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-emerald-100 backdrop-blur-sm border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-[0.3em] shadow-lg">
              <Sprout className="w-4 h-4 text-emerald-600" />
              FSA Bénin • Portail Officiel
           </div>

           <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 tracking-tight sm:tracking-tighter leading-[0.95] md:leading-[1.05] lg:max-w-6xl mx-auto px-4">
              Passez vos examens FSA en ligne. <br />
              Obtenez votre <span className="text-emerald-600">attestation</span> <span className="text-blue-600">instantanément.</span>
           </h1>

           <p className="text-slate-500 font-bold text-base md:text-lg max-w-xl mx-auto leading-relaxed px-4">
             Évaluez vos compétences et obtenez vos certifications officielles de la Ferme Cité St André.
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
