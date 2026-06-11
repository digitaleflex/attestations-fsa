'use client';

import { useState, useEffect } from 'react';
import {
  FileText, Scan, ShieldCheck, Briefcase,
  Search, ClipboardCheck, GraduationCap, MapPin,
  Send, Users, Monitor, Award, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CONTENT = {
  internships: {
    title: "Stages & Formations",
    subtitle: "Rejoignez l'élite agricole",
    color: "emerald",
    steps: [
      {
        icon: <Send className="w-6 h-6" />,
        title: "Candidature",
        description: "Remplissez le formulaire en ligne avec vos documents personnels."
      },
      {
        icon: <Users className="w-6 h-6" />,
        title: "Sélection",
        description: "Étude de votre dossier par notre équipe pédagogique sous 48h."
      },
      {
        icon: <MapPin className="w-6 h-6" />,
        title: "Immersion",
        description: "Début de votre formation pratique au cœur de la ferme Saint André."
      }
    ]
  },
  exams: {
    title: "Examens Officiels",
    subtitle: "Validez vos compétences",
    color: "blue",
    steps: [
      {
        icon: <Monitor className="w-6 h-6" />,
        title: "Accès",
        description: "Identifiez-vous sur votre espace sécurisé pour lancer l'examen."
      },
      {
        icon: <ClipboardCheck className="w-6 h-6" />,
        title: "Passage",
        description: "Répondez aux questions interactives chronométrées avec soin."
      },
      {
        icon: <Award className="w-6 h-6" />,
        title: "Validation",
        description: "Recevez vos notes et votre certification instantanément."
      }
    ]
  },
  verification: {
    title: "Vérification",
    subtitle: "Authenticité garantie",
    color: "amber",
    steps: [
      {
        icon: <Search className="w-6 h-6" />,
        title: "Recherche",
        description: "Entrez le matricule unique ou scannez le QR code du document."
      },
      {
        icon: <FileText className="w-6 h-6" />,
        title: "Analyse",
        description: "Notre moteur de sécurité scrute la base de données officielle."
      },
      {
        icon: <ShieldCheck className="w-6 h-6" />,
        title: "Confirmation",
        description: "Obtenez un statut officiel en temps réel avec preuve d'intégrité."
      }
    ]
  }
};

export function HowItWorks() {
    const [activeTab, setActiveTab] = useState<'internships' | 'exams' | 'verification'>('internships');
    const current = CONTENT[activeTab];
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
      setActiveStepIndex(0);
    }, [activeTab]);

    useEffect(() => {
      if (isPaused) return;
      const interval = setInterval(() => {
        setActiveStepIndex((prev) => (prev + 1) % current.steps.length);
      }, 4500); // 4.5s
      return () => clearInterval(interval);
    }, [isPaused, current.steps.length]);

    const getColorClass = (type: string) => {
      switch(type) {
        case 'emerald': return 'bg-emerald-500 text-white shadow-emerald-500/25';
        case 'blue': return 'bg-blue-600 text-white shadow-blue-600/25';
        case 'amber': return 'bg-amber-500 text-white shadow-amber-500/25';
        default: return 'bg-slate-900 text-white';
      }
    };

    return (
        <div className="w-full max-w-6xl mx-auto my-24 px-6 min-h-[600px]">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    Comment ça <span className="text-emerald-600">marche ?</span>
                </h2>
                <p className="text-slate-500 font-medium max-w-xl mx-auto">
                    Que vous soyez candidat à un stage, étudiant prêt pour l'examen ou une entité vérificatrice, nous avons simplifié chaque étape.
                </p>
            </div>

            {/* Tab Swiitcher */}
            <div className="flex flex-wrap justify-center gap-3 mb-16 p-2 bg-slate-100 rounded-[2rem] w-fit mx-auto border border-slate-200/50">
                {Object.entries(CONTENT).map(([key, value]) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key as any)}
                        className={`px-8 py-4 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-2 relative z-10 ${
                            activeTab === key
                            ? `${getColorClass(value.color)} scale-105`
                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/80'
                        }`}
                    >
                        {key === 'internships' && <Briefcase className="w-4 h-4" />}
                        {key === 'exams' && <GraduationCap className="w-4 h-4" />}
                        {key === 'verification' && <ShieldCheck className="w-4 h-4" />}
                        {value.title}
                    </button>
                ))}
            </div>

            {/* Content Display */}
            <div className="relative">
              <AnimatePresence initial={false}>
                  <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, scale: 0.98, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: -10 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="w-full"
                  >
                      {/* ================= LAYOUT DESKTOP (Grille 3 colonnes) ================= */}
                      <div className="hidden md:grid grid-cols-3 gap-12 relative py-4">
                          {current.steps.map((step, index) => (
                              <div key={index} className="relative group">
                                  <div className="flex flex-col items-center text-center space-y-6">
                                      {/* Icon with Circle */}
                                      <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 shadow-sm ${
                                          activeTab === 'internships' ? 'bg-emerald-100 text-emerald-600' :
                                          activeTab === 'exams' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                                      }`}>
                                          {step.icon}
                                      </div>

                                      <div className="space-y-3">
                                          <h3 className="text-xl font-extrabold text-slate-800">
                                              {index + 1}. {step.title}
                                          </h3>
                                          <p className="text-slate-500 text-sm leading-relaxed font-semibold">
                                              {step.description}
                                          </p>
                                      </div>
                                  </div>

                                  {/* Connector (Desktop Only) */}
                                  {index < 2 && (
                                      <div className="hidden lg:block absolute top-10 -right-6 w-12 h-[2px] bg-slate-200/60" />
                                  )}
                              </div>
                          ))}
                      </div>

                      {/* ================= LAYOUT MOBILE (Carrousel avec flèches absolues) ================= */}
                      <div 
                        className="block md:hidden relative w-full py-4"
                        onTouchStart={() => setIsPaused(true)}
                        onTouchEnd={() => setIsPaused(false)}
                        onMouseEnter={() => setIsPaused(true)}
                        onMouseLeave={() => setIsPaused(false)}
                      >
                        {/* Conteneur relatif pour les flèches absolues + carte centrée */}
                        <div className="relative w-full">
                          {/* Flèche Gauche – positionnée en absolu à mi-hauteur */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStepIndex((prev) => (prev - 1 + current.steps.length) % current.steps.length);
                              setIsPaused(true);
                              setTimeout(() => setIsPaused(false), 6000);
                            }}
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-50 border border-slate-100/80 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shadow-sm"
                            aria-label="Étape précédente"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>

                          {/* Carte centrale – toujours centrée sur toute la largeur */}
                          <div className="px-12 min-h-[240px] flex items-center justify-center overflow-hidden">
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={`${activeTab}-${activeStepIndex}`}
                                initial={{ opacity: 0, scale: 0.95, x: 15 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95, x: -15 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="w-full max-w-xs mx-auto p-6 rounded-[2rem] bg-white border border-slate-100 shadow-[0_12px_30px_rgba(0,0,0,0.05)]"
                              >
                                <div className="flex flex-col items-center text-center space-y-4">
                                  {/* Icône */}
                                  <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center shadow-inner ${
                                      activeTab === 'internships' ? 'bg-emerald-100 text-emerald-600' :
                                      activeTab === 'exams' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                                  }`}>
                                      {current.steps[activeStepIndex].icon}
                                  </div>

                                  <div className="space-y-2">
                                      <h3 className="text-lg font-black text-slate-800">
                                          {activeStepIndex + 1}. {current.steps[activeStepIndex].title}
                                      </h3>
                                      <p className="text-slate-500 text-xs leading-relaxed font-bold px-2">
                                          {current.steps[activeStepIndex].description}
                                      </p>
                                  </div>
                                </div>
                              </motion.div>
                            </AnimatePresence>
                          </div>

                          {/* Flèche Droite – positionnée en absolu à mi-hauteur */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStepIndex((prev) => (prev + 1) % current.steps.length);
                              setIsPaused(true);
                              setTimeout(() => setIsPaused(false), 6000);
                            }}
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-50 border border-slate-100/80 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shadow-sm"
                            aria-label="Étape suivante"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Indicateurs (points) */}
                        <div className="flex justify-center items-center gap-1.5 mt-4">
                          {current.steps.map((_, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setActiveStepIndex(index);
                                setIsPaused(true);
                                setTimeout(() => setIsPaused(false), 6000);
                              }}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                activeStepIndex === index 
                                  ? activeTab === 'internships' ? 'w-5 bg-emerald-600' :
                                    activeTab === 'exams' ? 'w-5 bg-blue-600' : 'w-5 bg-amber-600'
                                  : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                              }`}
                              aria-label={`Aller à l'étape ${index + 1}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Scenario Highlight Bar */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-20 p-8 rounded-[2.5rem] bg-white border border-slate-100 text-center shadow-xl shadow-slate-200/20"
                      >
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                            activeTab === 'internships' ? 'text-emerald-600' :
                            activeTab === 'exams' ? 'text-blue-600' : 'text-amber-600'
                          }`}>Section {current.title}</span>
                          <p className="text-base italic font-bold text-slate-700 mt-2">
                              "{current.subtitle}"
                          </p>
                      </motion.div>
                  </motion.div>
              </AnimatePresence>
            </div>
        </div>
    );
}

