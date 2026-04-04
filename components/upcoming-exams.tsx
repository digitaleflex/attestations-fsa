'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, ArrowRight, Loader2, BookOpen,
  GraduationCap, Sparkles
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ScheduledExam = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  duration: number;
  status: string;
};

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
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-semibold">
        Disponible maintenant
      </Badge>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${isVeryUrgent ? 'text-red-600 animate-pulse' : isUrgent ? 'text-amber-600' : 'text-slate-600'}`}>
      <Clock className={`w-4 h-4 ${isVeryUrgent ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-slate-400'}`} />
      <div className="flex items-center gap-2 font-mono font-bold">
        <div className="flex flex-col items-center">
          <span className="text-lg leading-none">{timeLeft.days}</span>
          <span className="text-[9px] uppercase opacity-60">J</span>
        </div>
        <span className="opacity-40">:</span>
        <div className="flex flex-col items-center">
          <span className="text-lg leading-none">{timeLeft.hours}</span>
          <span className="text-[9px] uppercase opacity-60">H</span>
        </div>
        <span className="opacity-40">:</span>
        <div className="flex flex-col items-center">
          <span className="text-lg leading-none">{timeLeft.minutes}</span>
          <span className="text-[9px] uppercase opacity-60">M</span>
        </div>
        <span className="opacity-40">:</span>
        <div className="flex flex-col items-center">
          <span className="text-lg leading-none">{timeLeft.seconds}</span>
          <span className="text-[9px] uppercase opacity-60">S</span>
        </div>
      </div>
    </div>
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
      {/* Hover Glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-indigo-400/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative h-full p-8 bg-white border border-slate-100 rounded-3xl shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:border-blue-200">
        {/* Date Badge */}
        <div className="flex items-center justify-between mb-6">
          <Badge variant="outline" className={`px-3 py-1 font-semibold ${
            isPast
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {isPast ? '✅ Disponible' : '📅 Programmé'}
          </Badge>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock className="w-4 h-4" />
            <span className="font-semibold">{durationMinutes} min</span>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-blue-700 transition-colors">
              {exam.name || exam.title}
            </h3>
            {exam.description && (
              <p className="text-slate-500 text-sm mt-2 line-clamp-2 leading-relaxed">
                {exam.description}
              </p>
            )}
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-medium capitalize">{formattedDate}</span>
          </div>

          {/* Countdown */}
          <div className="pt-2">
            <CountdownDisplay targetDate={exam.scheduledAt} />
          </div>
        </div>

        {/* CTA */}
        <div className="pt-6 mt-6 border-t border-slate-100">
          <Link href={isPast ? `/exams/${exam.id}` : '/exams'} className="block">
            <Button
              className={`w-full gap-2 font-semibold transition-all ${
                isPast
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200'
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

export function UpcomingExams() {
  const [exams, setExams] = useState<ScheduledExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await fetch('/api/public/exams');
        if (!res.ok) throw new Error('Erreur');
        const data = await res.json();
        // Sort by scheduledAt ascending
        const sorted = (data.exams || data || []).sort(
          (a: ScheduledExam, b: ScheduledExam) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );
        setExams(sorted.slice(0, 3)); // Show max 3
      } catch (err) {
        console.error('Failed to fetch upcoming exams:', err);
        setExams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  if (loading) {
    return (
      <section className="w-full max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-[0.2em]">
            <Calendar className="w-3.5 h-3.5" />
            Prochains Examens
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            Ne manquez{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              aucune session
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 bg-slate-100 animate-pulse rounded-3xl" />
          ))}
        </div>
      </section>
    );
  }

  if (exams.length === 0) {
    return (
      <section className="w-full max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-[0.2em]">
            <Calendar className="w-3.5 h-3.5" />
            Prochains Examens
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            Ne manquez{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              aucune session
            </span>
          </h2>
        </div>

        <div className="text-center py-16 bg-slate-50 rounded-3xl border border-slate-100">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-6">
            <GraduationCap className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">Aucun examen programmé</h3>
          <p className="text-slate-500 font-medium mb-6">
            Les prochains examens apparaîtront ici dès qu'ils seront planifiés.
          </p>
          <Link href="/exams">
            <Button variant="outline" className="gap-2">
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-[0.2em]">
          <Sparkles className="w-3.5 h-3.5" />
          À ne pas manquer
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
          Prochains{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            Examens
          </span>
        </h2>
        <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto">
          Inscrivez-vous aux sessions planifiées et préparez-vous avec le compte à rebours.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {exams.map((exam, index) => (
          <ExamCard key={exam.id} exam={exam} index={index} />
        ))}
      </div>

      {/* View All */}
      <div className="text-center mt-12">
        <Link href="/exams">
          <Button variant="outline" size="lg" className="gap-2 font-semibold">
            Voir tous les examens
            <ArrowRight className="w-4 h-4 transition-transform hover:translate-x-1" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
