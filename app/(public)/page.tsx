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
    <div className="flex-1 flex flex-col items-center justify-center w-full pb-24 relative bg-canvas overflow-hidden">

      {/* Décor organique discret */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-24 -right-16 w-[28rem] h-[28rem] rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-[24rem] h-[24rem] rounded-full bg-ocean/10 blur-3xl" />
        <div className="absolute bottom-16 right-1/4 w-72 h-72 rounded-full bg-harvest/10 blur-3xl" />
      </div>

      {/* --- HERO SECTION --- */}
      <section className="relative w-full min-h-[68vh] flex flex-col items-center justify-center text-center overflow-hidden pt-20 md:pt-24 px-4 pb-14">

        <div className="relative z-10 max-w-5xl w-full space-y-7">
           <div className="animate-rise inline-flex items-center gap-3 pl-2 pr-5 py-2 rounded-pill bg-white/80 backdrop-blur-sm border border-line text-brand-strong text-[11px] font-extrabold uppercase tracking-[0.24em] shadow-soft">
              <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-brand-soft">
                <Sprout className="w-3.5 h-3.5 text-brand-strong" />
              </span>
              FSA Bénin • Portail officiel
           </div>

           <h1
             className="animate-rise text-4xl sm:text-5xl md:text-7xl lg:text-[5.25rem] font-extrabold text-ink tracking-[-0.03em] leading-[0.98] md:leading-[1.02] lg:max-w-5xl mx-auto px-2"
             style={{ animationDelay: '90ms' }}
           >
              Votre <span className="text-brand">certification</span>,{" "}
              <span className="text-ocean">en un clic.</span>
           </h1>

           <p
             className="animate-rise text-ink-muted font-medium text-base md:text-lg max-w-xl mx-auto leading-relaxed px-4"
             style={{ animationDelay: '180ms' }}
           >
             Examens en ligne et attestations officielles de la Ferme Cité St André.
           </p>

           <div
             className="animate-rise flex flex-col md:flex-row items-center justify-center gap-4 pt-3"
             style={{ animationDelay: '270ms' }}
           >
                 <Link
                     href="/auth"
                     className="group inline-flex items-center justify-center gap-2.5 h-14 px-9 rounded-pill bg-brand text-white font-bold text-base shadow-soft hover:bg-brand-strong hover:shadow-lifted hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
                 >
                     Accéder à mon espace
                     <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
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
