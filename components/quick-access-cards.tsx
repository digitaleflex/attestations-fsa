'use client';

import Link from "next/link";
import { ShieldCheck, ClipboardCheck, Briefcase, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const CARDS = [
  {
    id: 'certificats',
    title: 'Certificats',
    description: 'Authentification instantanée via QR code ou numéro unique.',
    href: '/verifier',
    icon: ShieldCheck,
    color: 'emerald',
    glowColor: 'from-emerald-500/20 to-teal-400/20',
    iconBg: 'bg-emerald-500',
    iconText: 'text-emerald-600',
    borderColor: 'border-emerald-100/50',
    hoverBorder: 'group-hover:border-emerald-300'
  },
  {
    id: 'examens',
    title: 'Examens',
    description: 'Espace dédié pour vos évaluations et le suivi de vos résultats.',
    href: '/exams',
    icon: ClipboardCheck,
    color: 'blue',
    glowColor: 'from-blue-500/20 to-indigo-400/20',
    iconBg: 'bg-blue-500',
    iconText: 'text-blue-600',
    borderColor: 'border-blue-100/50',
    hoverBorder: 'group-hover:border-blue-300'
  },
  {
    id: 'stages',
    title: 'Stages',
    description: 'Immersion complète dans l\'élevage et l\'agriculture de demain.',
    href: '/demande-stage',
    icon: Briefcase,
    color: 'rose',
    glowColor: 'from-rose-500/20 to-pink-400/20',
    iconBg: 'bg-rose-500',
    iconText: 'text-rose-600',
    borderColor: 'border-rose-100/50',
    hoverBorder: 'group-hover:border-rose-300'
  }
];

export function QuickAccessCards() {
  return (
    <section className="max-w-7xl w-full px-6 grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 overflow-visible py-12 bg-white">
      {CARDS.map((card, index) => (
        <div
          key={card.id}
          className="group relative"
        >
          {/* Card Glow Effect */}
          <div className={`absolute -inset-2 bg-gradient-to-r ${card.glowColor} rounded-[2.5rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
          
          <Link href={card.href} className="block h-full relative z-10">
            <div className={`h-full p-8 md:p-10 bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-4 overflow-hidden rounded-[2.5rem] hover:border-emerald-300 hover:shadow-2xl`}>
              
              {/* Background Glass Decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/90 transition-colors" />

              {/* Icon Container */}
              <div className={`relative w-20 h-20 rounded-2xl ${card.iconBg} text-white flex items-center justify-center mb-8 shadow-xl shadow-slate-200/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 ease-out z-10`}>
                <card.icon className="w-10 h-10" />
              </div>

              <div className="relative z-10 space-y-4 text-left">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none group-hover:text-emerald-700 transition-colors">
                  {card.title}
                </h3>
                
                <p className="text-slate-500 font-bold text-base leading-relaxed">
                  {card.description}
                </p>

                <div className="pt-4 flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-slate-900 transition-colors">
                      Détails
                    </span>
                    <div className="h-[2px] w-8 bg-slate-100 group-hover:w-12 group-hover:bg-slate-300 transition-all duration-500" />
                    <ChevronRight className={`w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-500 ${card.iconText}`} />
                </div>
              </div>

              {/* Bottom Decorative Bar */}
              <div className={`absolute bottom-0 left-0 h-1.5 w-0 bg-gradient-to-r ${card.glowColor.replace('/20', '')} transition-all duration-700 group-hover:w-full`} />
            </div>
          </Link>
        </div>
      ))}
    </section>
  );
}
