'use client';

import { motion } from 'framer-motion';
import {
  ShieldCheck, Zap, Globe, QrCode, Clock, Award,
  ChevronRight, CheckCircle2
} from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Anti-triche intelligent',
    description: 'Surveillance en temps réel des changements d\'onglet, patterns de réponses et comportements suspects pendant les examens.',
    color: 'emerald',
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-500',
    text: 'text-emerald-600',
    border: 'border-emerald-100',
    glow: 'from-emerald-500/20 to-teal-400/20',
    features: ['Détection tab switching', 'Analyse similarité', 'Logs automatiques']
  },
  {
    icon: Zap,
    title: 'Résultats instantanés',
    description: 'Correction automatique des QCM avec score calculé en temps réel. Résultats disponibles immédiatement après soumission.',
    color: 'blue',
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-500',
    text: 'text-blue-600',
    border: 'border-blue-100',
    glow: 'from-blue-500/20 to-indigo-400/20',
    features: ['QCM auto-corrigé', 'Score immédiat', 'Email de résultat']
  },
  {
    icon: QrCode,
    title: 'Vérification QR Code',
    description: 'Chaque attestation dispose d\'un code unique vérifiable en temps réel. Les recruteurs peuvent authentifier vos diplômes.',
    color: 'violet',
    bg: 'bg-violet-50',
    iconBg: 'bg-violet-500',
    text: 'text-violet-600',
    border: 'border-violet-100',
    glow: 'from-violet-500/20 to-purple-400/20',
    features: ['Code unique', 'Vérification live', 'Anti-falsification']
  },
  {
    icon: Globe,
    title: 'Portfolio public',
    description: 'Créez votre portfolio numérique professionnel avec vos attestations, examens réussis et compétences certifiées.',
    color: 'amber',
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-500',
    text: 'text-amber-600',
    border: 'border-amber-100',
    glow: 'from-amber-500/20 to-orange-400/20',
    features: ['URL personnalisable', 'Partageable', 'Infalsifiable']
  },
  {
    icon: Clock,
    title: 'Examens programmés',
    description: 'Les administrateurs planifient les examens avec date et heure. Compte à rebours automatique pour les candidats.',
    color: 'rose',
    bg: 'bg-rose-50',
    iconBg: 'bg-rose-500',
    text: 'text-rose-600',
    border: 'border-rose-100',
    glow: 'from-rose-500/20 to-pink-400/20',
    features: ['Planification admin', 'Countdown candidat', 'Rappels auto']
  },
  {
    icon: Award,
    title: 'Attestations certifiées',
    description: 'Documents officiels avec filigrane de sécurité, fingerprint cryptographique et watermark invisible anti-contrefaçon.',
    color: 'cyan',
    bg: 'bg-cyan-50',
    iconBg: 'bg-cyan-500',
    text: 'text-cyan-600',
    border: 'border-cyan-100',
    glow: 'from-cyan-500/20 to-blue-400/20',
    features: ['Watermark invisible', 'Fingerprint crypto', 'PDF téléchargeable']
  }
];

function getColorClasses(color: string) {
  const map: Record<string, { bg: string; icon: string; text: string; border: string; hover: string }> = {
    emerald: {
      bg: 'bg-emerald-50',
      icon: 'bg-emerald-500',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
      hover: 'group-hover:border-emerald-300 group-hover:bg-emerald-50/50'
    },
    blue: {
      bg: 'bg-blue-50',
      icon: 'bg-blue-500',
      text: 'text-blue-600',
      border: 'border-blue-100',
      hover: 'group-hover:border-blue-300 group-hover:bg-blue-50/50'
    },
    violet: {
      bg: 'bg-violet-50',
      icon: 'bg-violet-500',
      text: 'text-violet-600',
      border: 'border-violet-100',
      hover: 'group-hover:border-violet-300 group-hover:bg-violet-50/50'
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'bg-amber-500',
      text: 'text-amber-600',
      border: 'border-amber-100',
      hover: 'group-hover:border-amber-300 group-hover:bg-amber-50/50'
    },
    rose: {
      bg: 'bg-rose-50',
      icon: 'bg-rose-500',
      text: 'text-rose-600',
      border: 'border-rose-100',
      hover: 'group-hover:border-rose-300 group-hover:bg-rose-50/50'
    },
    cyan: {
      bg: 'bg-cyan-50',
      icon: 'bg-cyan-500',
      text: 'text-cyan-600',
      border: 'border-cyan-100',
      hover: 'group-hover:border-cyan-300 group-hover:bg-cyan-50/50'
    }
  };
  return map[color] || map.emerald;
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const colors = getColorClasses(feature.color);
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative"
    >
      {/* Hover Glow */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${feature.glow} rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

      <div className={`relative h-full p-8 bg-white border border-slate-100 rounded-3xl shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-xl ${colors.hover}`}>
        {/* Icon */}
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${colors.icon} text-white shadow-lg mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
          <Icon className="w-7 h-7" />
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-slate-800 transition-colors">
            {feature.title}
          </h3>

          <p className="text-slate-500 text-sm leading-relaxed font-medium">
            {feature.description}
          </p>

          {/* Feature bullets */}
          <ul className="space-y-2 pt-2">
            {feature.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${colors.text}`} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom accent bar */}
        <div className={`absolute bottom-0 left-6 right-6 h-1 rounded-full bg-gradient-to-r ${feature.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      </div>
    </motion.div>
  );
}

export function FeaturesGrid() {
  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-24">
      {/* Header */}
      <div className="text-center mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em]">
          <ShieldCheck className="w-3.5 h-3.5" />
          Fonctionnalités
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
          Tout ce qu'il faut pour{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">
            réussir
          </span>
        </h2>
        <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto">
          Une plateforme complète qui sécurise, certifie et valorise vos compétences agricoles.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {FEATURES.map((feature, index) => (
          <FeatureCard key={feature.title} feature={feature} index={index} />
        ))}
      </div>
    </section>
  );
}
