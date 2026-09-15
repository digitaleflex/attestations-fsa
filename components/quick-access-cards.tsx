'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, ClipboardCheck, Briefcase, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CARDS = [
  {
    id: 'certificats',
    title: 'Certificats',
    description: 'Authentification instantanée via QR code ou numéro unique.',
    href: '/verifier',
    icon: ShieldCheck,
    glowColor: 'from-emerald-500/20 to-teal-400/20',
    barColor: 'from-emerald-500 to-teal-400',
    iconBg: 'bg-brand',
    iconText: 'text-brand-strong',
  },
  {
    id: 'examens',
    title: 'Examens',
    description: 'Espace dédié pour vos évaluations et le suivi de vos résultats.',
    href: '/exams',
    icon: ClipboardCheck,
    glowColor: 'from-ocean/20 to-blue-400/20',
    barColor: 'from-ocean to-blue-400',
    iconBg: 'bg-ocean',
    iconText: 'text-ocean-strong',
  },
  {
    id: 'stages',
    title: 'Stages',
    description: 'Immersion complète dans l\'élevage et l\'agriculture de demain.',
    href: '/demande-stage',
    icon: Briefcase,
    glowColor: 'from-amber-400/20 to-orange-400/20',
    barColor: 'from-amber-400 to-orange-400',
    iconBg: 'bg-harvest',
    iconText: 'text-amber-600',
  }
];

export function QuickAccessCards() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CARDS.length);
    }, 4500); // Défilement automatique toutes les 4.5 secondes
    return () => clearInterval(interval);
  }, [isPaused]);

  const activeCard = CARDS[activeIndex];

  return (
    <>
      {/* ================= LAYOUT DESKTOP (Grille fixe) ================= */}
      <section className="hidden md:grid max-w-7xl w-full px-6 grid-cols-3 gap-8 relative z-10 overflow-visible py-14 bg-canvas">
        {CARDS.map((card) => (
          <div
            key={card.id}
            className="group relative"
          >
            {/* Card Glow Effect */}
            <div className={`absolute -inset-2 bg-gradient-to-r ${card.glowColor} rounded-panel blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

            <Link
              href={card.href}
              className="block h-full relative z-10 rounded-panel focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
            >
              <div className="h-full p-8 md:p-10 bg-white/95 backdrop-blur-xl border border-line shadow-soft transition-all duration-500 hover:-translate-y-3 overflow-hidden rounded-panel hover:shadow-lifted">

                {/* Background Glass Decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-surface-muted/60 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/90 transition-colors" />

                {/* Icon Container */}
                <div className={`relative w-20 h-20 rounded-action ${card.iconBg} text-white flex items-center justify-center mb-8 shadow-soft group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ease-out z-10`}>
                  <card.icon className="w-10 h-10" />
                </div>

                <div className="relative z-10 space-y-4 text-left">
                  <h3 className="text-3xl font-extrabold text-ink tracking-tight leading-none group-hover:text-brand-strong transition-colors">
                    {card.title}
                  </h3>

                  <p className="text-ink-muted font-medium text-base leading-relaxed">
                    {card.description}
                  </p>

                  <div className="pt-4 flex items-center gap-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-muted group-hover:text-ink transition-colors">
                        Détails
                      </span>
                      <div className="h-[2px] w-8 bg-line group-hover:w-12 group-hover:bg-brand/40 transition-all duration-500" />
                      <ChevronRight className={`w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-500 ${card.iconText}`} />
                  </div>
                </div>

                {/* Bottom Decorative Bar */}
                <div className={`absolute bottom-0 left-0 h-1.5 w-0 bg-gradient-to-r ${card.barColor} transition-all duration-700 group-hover:w-full`} />
              </div>
            </Link>
          </div>
        ))}
      </section>

      {/* ================= LAYOUT MOBILE (Carrousel Auto-défilant) ================= */}
      <section
        className="block md:hidden w-full px-6 py-10 bg-canvas relative z-10 overflow-hidden text-center"
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="relative min-h-[300px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCard.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="w-full max-w-sm group relative"
            >
              {/* Card Glow Effect */}
              <div className={`absolute -inset-1.5 bg-gradient-to-r ${activeCard.glowColor} rounded-panel blur-2xl opacity-10`} />

              <Link
                href={activeCard.href}
                className="block h-full relative z-10 rounded-panel focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
              >
                <div className="h-full p-8 bg-white/95 backdrop-blur-xl border border-line shadow-soft rounded-panel text-center">

                  {/* Background Glass Decoration */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-surface-muted/60 rounded-full blur-2xl -mr-12 -mt-12" />

                  {/* Icon Container (Centré en mobile) */}
                  <div className={`relative w-16 h-16 rounded-action ${activeCard.iconBg} text-white flex items-center justify-center mb-6 mx-auto shadow-soft`}>
                    <activeCard.icon className="w-8 h-8" />
                  </div>

                  <div className="relative z-10 space-y-3">
                    <h3 className="text-2xl font-extrabold text-ink tracking-tight leading-none">
                      {activeCard.title}
                    </h3>

                    <p className="text-ink-muted font-medium text-sm leading-relaxed max-w-[260px] mx-auto">
                      {activeCard.description}
                    </p>

                    <div className="pt-3 flex items-center justify-center gap-2.5">
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ink-muted">
                          Détails
                        </span>
                        <div className="h-[2px] w-6 bg-line" />
                        <ChevronRight className={`w-4 h-4 opacity-55 ${activeCard.iconText}`} />
                    </div>
                  </div>

                  {/* Bottom Decorative Bar */}
                  <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${activeCard.barColor}`} />
                </div>
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel Indicators (Petits points) */}
        <div className="flex justify-center items-center gap-2 mt-5 relative z-20">
          {CARDS.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setActiveIndex(index);
                // Mettre en pause temporairement pour donner le contrôle à l'utilisateur
                setIsPaused(true);
                setTimeout(() => setIsPaused(false), 6000);
              }}
              className={`h-2 rounded-pill transition-all duration-300 ${
                activeIndex === index
                  ? "w-7 bg-brand shadow-soft"
                  : "w-2 bg-line hover:bg-slate-300"
              }`}
              aria-label={`Aller au slide ${index + 1}`}
            />
          ))}
        </div>
      </section>
    </>
  );
}
