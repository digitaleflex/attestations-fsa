"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar, Clock, ArrowRight, BookOpen,
  GraduationCap, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ScheduledExam = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  scheduledAt: Date | string;
  duration: number;
  status: string;
};

interface UpcomingExamsClientProps {
    initialExams: ScheduledExam[];
}

export default function UpcomingExamsClient({ initialExams }: UpcomingExamsClientProps) {
  if (initialExams.length === 0) {
    return (
      <section className="w-full max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-pill bg-blue-50 border border-blue-100 text-ocean-strong text-[10px] font-extrabold uppercase tracking-[0.2em]">
            <Calendar className="w-3.5 h-3.5" />
            Prochains Examens
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-ink tracking-tight">
            Ne manquez{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-ocean to-blue-500">
              aucune session
            </span>
          </h2>
        </div>

        <div className="text-center py-16 bg-surface-muted rounded-panel border border-line shadow-soft">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-pill bg-white mb-6 shadow-soft">
            <GraduationCap className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-ink mb-2">Aucun examen programmé</h3>
          <p className="text-ink-muted font-medium mb-6">
            Les prochains examens apparaîtront ici dès qu'ils seront planifiés.
          </p>
          <Link href="/exams">
            <Button variant="outline" className="gap-2 rounded-action">
              Voir les examens disponibles
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-24">
      {/* Header */}
      <div className="text-center mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-pill bg-blue-50 border border-blue-100 text-ocean-strong text-[10px] font-extrabold uppercase tracking-[0.2em]">
          <Sparkles className="w-3.5 h-3.5" />
          À ne pas manquer
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold text-ink tracking-tight">
          Prochains{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-ocean to-blue-500">
            Examens
          </span>
        </h2>
        <p className="text-ink-muted text-lg font-medium max-w-2xl mx-auto leading-relaxed">
          Inscrivez-vous aux sessions planifiées et préparez-vous avec le compte à rebours.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {initialExams.map((exam, index) => (
          <ExamCard key={exam.id} exam={exam} index={index} />
        ))}
      </div>

      {/* View All */}
      <div className="text-center mt-12">
        <Link href="/exams">
          <Button variant="outline" size="lg" className="gap-2 font-semibold rounded-action h-14 px-10">
            Voir tous les examens
            <ArrowRight className="w-4 h-4 transition-transform hover:translate-x-1" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function ExamCard({ exam, index }: { exam: ScheduledExam; index: number }) {
  const scheduledDate = new Date(exam.scheduledAt);
  const formattedDate = scheduledDate.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const durationMinutes = Math.round(exam.duration / 60);
  const isPast = new Date(exam.scheduledAt) <= new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.15 }}
      className="group relative"
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-indigo-400/20 rounded-panel blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative h-full p-8 bg-surface border border-line rounded-panel shadow-soft transition-all duration-500 hover:-translate-y-2 hover:shadow-lifted hover:border-blue-200">
        <div className="flex items-center justify-between mb-6">
          <Badge variant="outline" className={`px-3 py-1 font-bold uppercase text-[9px] tracking-widest ${
            isPast
              ? 'bg-brand-soft text-brand-strong border-emerald-200'
              : 'bg-blue-50 text-ocean-strong border-blue-100'
          }`}>
            {isPast ? 'Disponible' : 'Programmé'}
          </Badge>
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-ink-muted uppercase tracking-widest">
            <Clock className="w-3.5 h-3.5" />
            <span>{durationMinutes} min</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-xl md:text-2xl font-extrabold text-ink tracking-tight group-hover:text-ocean-strong transition-colors">
              {exam.name || exam.title}
            </h3>
            {exam.description && (
              <p className="text-ink-muted text-sm mt-3 line-clamp-2 leading-relaxed font-medium">
                {exam.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-600 font-bold bg-surface-muted p-3 rounded-action">
            <Calendar className="w-4 h-4 text-ocean" />
            <span className="capitalize">{formattedDate}</span>
          </div>

          <div className="pt-2">
            <CountdownDisplay targetDate={String(exam.scheduledAt)} />
          </div>
        </div>

        <div className="pt-6 mt-6 border-t border-line">
          <Link href={isPast ? `/exams/${exam.id}` : '/exams'} className="block">
            <Button
              className={`w-full h-14 rounded-action gap-2 font-extrabold uppercase text-xs tracking-widest transition-all ${
                isPast
                  ? 'bg-brand hover:bg-brand-strong text-white shadow-soft'
                  : 'bg-ink hover:bg-slate-800 text-white shadow-soft'
              }`}
            >
              {isPast ? 'Commencer maintenant' : "S'inscrire"}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function CountdownDisplay({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        isPast: false
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 24;
  const isVeryUrgent = timeLeft.days === 0 && timeLeft.hours < 1;

  if (timeLeft.isPast) {
    return (
      <Badge className="bg-brand-soft text-brand-strong border-emerald-200 font-extrabold text-[10px] tracking-widest uppercase py-1.5 px-4 rounded-pill">
        Session Ouverte
      </Badge>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${isVeryUrgent ? 'text-rose-600 animate-pulse' : isUrgent ? 'text-amber-600' : 'text-slate-600'}`}>
      <Clock className={`w-4 h-4 ${isVeryUrgent ? 'text-rose-500' : isUrgent ? 'text-amber-500' : 'text-slate-400'}`} />
      <div className="flex items-center gap-2 font-mono font-extrabold">
        <div className="flex flex-col items-center">
          <span className="text-xl leading-none">{timeLeft.days}</span>
          <span className="text-[8px] uppercase opacity-40">J</span>
        </div>
        <span className="opacity-20">:</span>
        <div className="flex flex-col items-center">
          <span className="text-xl leading-none">{timeLeft.hours}</span>
          <span className="text-[8px] uppercase opacity-40">H</span>
        </div>
        <span className="opacity-20">:</span>
        <div className="flex flex-col items-center">
          <span className="text-xl leading-none">{timeLeft.minutes}</span>
          <span className="text-[8px] uppercase opacity-40">M</span>
        </div>
        <span className="opacity-20">:</span>
        <div className="flex flex-col items-center">
          <span className="text-xl leading-none">{timeLeft.seconds}</span>
          <span className="text-[8px] uppercase opacity-40">S</span>
        </div>
      </div>
    </div>
  );
}
