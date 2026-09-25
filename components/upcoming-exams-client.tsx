"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  GraduationCap,
  Info,
  Lock,
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

type PublicExamState = "OPEN" | "UPCOMING" | "CLOSED";

interface UpcomingExamsClientProps {
  initialExams: ScheduledExam[];
}

const statusPresentation: Record<
  PublicExamState,
  { label: string; description: string; className: string }
> = {
  OPEN: {
    label: "Session ouverte",
    description: "La session est accessible depuis votre compte candidat.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  UPCOMING: {
    label: "À venir",
    description: "L’accès sera disponible à l’ouverture de cette session.",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  CLOSED: {
    label: "Session close",
    description: "Cette session n’est plus accessible.",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
};

function getPublicExamState(
  exam: Pick<ScheduledExam, "status" | "scheduledAt">,
  now = new Date(),
): PublicExamState {
  if (exam.status !== "PUBLISHED" && exam.status !== "SCHEDULED") {
    return "CLOSED";
  }

  return new Date(exam.scheduledAt).getTime() <= now.getTime()
    ? "OPEN"
    : "UPCOMING";
}

export default function UpcomingExamsClient({ initialExams }: UpcomingExamsClientProps) {
  if (initialExams.length === 0) {
    return (
      <section className="w-full max-w-7xl px-5 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-12 md:rounded-[2.5rem]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
            <GraduationCap className="h-9 w-9 text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-brand">
            Examens publics
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-ink sm:text-4xl">
            Aucune session à afficher
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
            Les sessions ouvertes ou programmées apparaîtront ici dès leur
            publication.
          </p>
          <Button asChild variant="outline" size="lg" className="mt-8 gap-2">
            <Link href="/formations">
              Explorer les formations
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-7xl px-5 py-16 sm:px-6 md:py-24">
      <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-brand">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Calendrier public
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-brand-ink sm:text-5xl md:text-6xl">
          Sessions d’examen
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-relaxed text-slate-600 md:text-lg">
          Consultez les informations pratiques avant de vous connecter. Une
          session annoncée comme à venir n’est pas encore accessible.
        </p>
      </div>

      <div className="mx-auto mb-8 grid max-w-3xl gap-3 rounded-3xl border border-brand-line bg-white p-5 shadow-sm sm:grid-cols-3 sm:p-6" aria-label="Légende des statuts">
        {(Object.keys(statusPresentation) as PublicExamState[]).map((state) => (
          <div key={state} className="flex items-start gap-3 sm:block">
            <Badge
              variant="outline"
              className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${statusPresentation[state].className}`}
            >
              {statusPresentation[state].label}
            </Badge>
            <p className="mt-0 text-xs font-medium leading-relaxed text-slate-500 sm:mt-3">
              {statusPresentation[state].description}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {initialExams.map((exam, index) => (
          <ExamCard key={exam.id} exam={exam} index={index} />
        ))}
      </div>
    </section>
  );
}

function ExamCard({ exam, index }: { exam: ScheduledExam; index: number }) {
  const state = getPublicExamState(exam);
  const presentation = statusPresentation[state];
  const scheduledDate = new Date(exam.scheduledAt);
  const formattedDate = scheduledDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedDuration =
    exam.duration > 0 && exam.duration < 60
      ? "< 1 min"
      : `${Math.round(exam.duration / 60)} min`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative h-full"
    >
      <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-br from-brand/15 to-brand-accent/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition duration-500 hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Badge
            variant="outline"
            className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${presentation.className}`}
          >
            {presentation.label}
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {formattedDuration}
          </span>
        </div>

        <h2 className="text-xl font-black leading-snug tracking-tight text-brand-ink transition-colors group-hover:text-brand sm:text-2xl">
          {exam.name || exam.title}
        </h2>
        {exam.description && (
          <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-slate-600">
            {exam.description}
          </p>
        )}

        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-slate-50 p-3.5 text-sm font-bold leading-relaxed text-slate-600">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <span className="capitalize">{formattedDate}</span>
        </div>

        <div className="mt-6 min-h-16">
          {state === "UPCOMING" ? (
            <CountdownDisplay targetDate={String(exam.scheduledAt)} />
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3.5 text-xs font-semibold leading-relaxed text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>{presentation.description}</span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6">
          {state === "OPEN" ? (
            <Button asChild className="h-14 min-h-14 w-full gap-2 rounded-2xl font-black">
              <Link href="/auth">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Se connecter pour passer l’examen
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <div className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-center text-xs font-black uppercase tracking-wide text-slate-500">
              {state === "UPCOMING" ? "Disponible à l’ouverture" : "Accès terminé"}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function CountdownDisplay({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, isPast: false });

  useEffect(() => {
    const calculateTime = () => {
      const diff = new Date(targetDate).getTime() - Date.now();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, isPast: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        isPast: false,
      });
    };

    calculateTime();
    const interval = window.setInterval(calculateTime, 60_000);
    return () => window.clearInterval(interval);
  }, [targetDate]);

  if (timeLeft.isPast) {
    return (
      <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
        La session vient d’ouvrir.
      </p>
    );
  }

  return (
    <div aria-label="Temps restant avant l’ouverture">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        Ouverture dans
      </p>
      <div className="grid grid-cols-3 gap-2">
        {[
          [timeLeft.days, "jours"],
          [timeLeft.hours, "heures"],
          [timeLeft.minutes, "minutes"],
        ].map(([value, unit]) => (
          <div key={unit} className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-2.5 text-center">
            <span className="block text-lg font-black leading-none text-brand-ink">
              {String(value).padStart(2, "0")}
            </span>
            <span className="mt-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
