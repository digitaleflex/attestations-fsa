// components/CountdownTimer.tsx
// Carte d'annonce d'un examen planifié, avec compte à rebours.
//
// Elle ne fait QUE trois choses : dire quand l'examen ouvre, dire quand il
// démarre, et n'exposer aucun contenu avant l'ouverture (voir
// `getScheduleView`). Tout ce qui est décisionnel vit dans
// `lib/exams/schedule-ui.ts` — ici, c'est de la présentation.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, EyeOff, Hourglass, Lock, Play, Sunrise } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  APP_TIMEZONE_LABEL,
  formatAppDate,
  formatAppDateTime,
  formatAppLongDate,
  formatDurationMinutes,
  describeCountdown,
  getCountdownParts,
  getScheduleView,
  padCountdown,
  type CountdownParts,
} from "@/lib/exams/schedule-ui";
import { cn } from "@/lib/utils";

export interface CountdownTimerProps {
  /** Heure de démarrage effective, en UTC. */
  scheduledAt: string;
  /** Jour d'ouverture (minuit Africa/Porto-Novo). Repli : déduit de `scheduledAt`. */
  opensOn?: string | null;
  /** Verdict serveur. `false` ferme le démarrage même à l'heure. */
  isAvailable?: boolean | null;
  examId: string;
  examName: string;
  /** Masqué tant que l'examen n'est pas ouvert. */
  examDescription?: string | null;
  /** Durée en secondes. Masquée tant que l'examen n'est pas ouvert. */
  duration?: number | null;
}

type Tone = "locked" | "soon" | "imminent" | "open";

const TONE_STYLES: Record<Tone, { rail: string; chip: string; digits: string }> = {
  locked: {
    rail: "before:border-slate-200",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    digits: "bg-white text-slate-800 ring-slate-200",
  },
  soon: {
    rail: "before:border-amber-400",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    digits: "bg-white text-slate-800 ring-amber-200",
  },
  imminent: {
    rail: "before:border-brand",
    chip: "bg-brand/10 text-brand-dark border-brand/20",
    digits: "bg-white text-brand-dark ring-brand/30",
  },
  open: {
    rail: "before:border-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    digits: "bg-white text-emerald-700 ring-emerald-200",
  },
};

const STATUS_LABEL: Record<Tone, string> = {
  locked: "À venir",
  soon: "Bientôt",
  imminent: "Imminent",
  open: "Session ouverte",
};

const STATUS_ICON = {
  locked: Lock,
  soon: CalendarClock,
  imminent: Hourglass,
  open: Play,
} as const;

/**
 * Teinte du compte à rebours. Au-delà d'une heure, l'urgence est réelle : on
 * passe sur la couleur de marque plutôt que sur du jaune décoratif.
 */
function getTone(parts: CountdownParts | null, isOpen: boolean): Tone {
  if (isOpen) return "open";
  if (!parts || parts.isPast) return "locked";
  if (parts.totalMs <= 60 * 60 * 1000) return "imminent";
  if (parts.totalMs <= 24 * 60 * 60 * 1000) return "soon";
  return "locked";
}

/**
 * Le compte à rebours vit seul.
 *
 * `now` n'est utilisé qu'au premier rendu : ensuite, chaque `tick` recalcule
 * l'échéance sur l'heure réelle. On ne le liste donc pas dans les dépendances
 * du `useMemo` — le lister rejouerait le calcul à chaque rendu du parent pour
 * un résultat identique.
 */
function useCountdown(target: Date | null, now: Date): CountdownParts | null {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!target) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [target]);

  // Le tick est le déclencheur : `now` sert uniquement à l'amorçage, et la
  // révision ci-dessous le remplace par l'heure réelle dès la première seconde.
  const startedAt = useRef(now);

  return useMemo(
    () =>
      target
        ? getCountdownParts(target, tick === 0 ? startedAt.current : new Date())
        : null,
    [target, tick],
  );
}

/**
 * Phrase annoncée aux lecteurs d'écran.
 *
 * Elle ne change qu'au changement de minute. Le décompte à la seconde, lui, est
 * décoré de `aria-hidden` : sixty announces par minute transformeraient la
 * carte enconversation impossible.
 */
function useAnnouncement(parts: CountdownParts | null, label: string): string {
  const [announcement, setAnnouncement] = useState("");
  const lastMinute = useRef<number | null>(null);

  useEffect(() => {
    if (!parts) return;
    if (lastMinute.current === parts.minutes) return;
    lastMinute.current = parts.minutes;
    setAnnouncement(describeCountdown(parts, label));
  }, [parts, label]);

  return announcement;
}

function CountdownUnit({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl px-2 py-3 text-center ring-1", className)}>
      {/* Chiffres purement décoratifs pour l'assistance : la phrase live plus
          bas porte la même information, une fois par minute. */}
      <span aria-hidden="true" className="block font-mono text-2xl font-black tabular-nums leading-none sm:text-3xl">
        {padCountdown(value)}
      </span>
      <span aria-hidden="true" className="mt-1.5 block text-[10px] font-bold uppercase tracking-widest opacity-70">
        {label}
      </span>
    </div>
  );
}

export function CountdownTimer({
  scheduledAt,
  opensOn,
  isAvailable,
  examId,
  examName,
  examDescription,
  duration,
}: CountdownTimerProps) {
  // Un seul `now` par rendu : sans cela, l'ouverture peut tomber entre deux
  // appels et faire clignoter la carte.
  const now = useMemo(() => new Date(), []);

  const schedule = useMemo(
    () => getScheduleView({ scheduledAt, opensOn, isAvailable }, now),
    [scheduledAt, opensOn, isAvailable, now],
  );
  const parts = useCountdown(schedule.countdownTarget, now);
  const tone = getTone(parts, schedule.phase === "STARTABLE");
  const announcement = useAnnouncement(
    parts,
    schedule.phase === "ANNOUNCED" ? "Début de l'épreuve" : "Ouverture de l'épreuve",
  );

  const StatusIcon = STATUS_ICON[tone];
  const durationLabel = formatDurationMinutes(duration);
  const targetLabel =
    schedule.phase === "ANNOUNCED" ? "Temps avant le début" : "Ouverture dans";

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-6 shadow-sm transition-shadow duration-300 hover:shadow-md",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        TONE_STYLES[tone].rail,
      )}
    >
      <div className="space-y-5">
        {/* En-tête : titre, statut, et ce que l'on a le droit de montrer. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-tight text-slate-800">
              {examName}
            </h3>
            {schedule.revealDetails && examDescription ? (
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">
                {examDescription}
              </p>
            ) : (
              // Avant l'ouverture, on ne montre NI description NI durée NI
              // barème : seulement ce que la spécification autorise.
              !schedule.revealDetails && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-500">
                  <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Détails révélés à l&apos;ouverture
                </p>
              )
            )}
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
              TONE_STYLES[tone].chip,
            )}
          >
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {STATUS_LABEL[tone]}
          </span>
        </div>

        {/* Compte à rebours, ou message d'ouverture. */}
        {parts && !parts.isPast ? (
          <div role="timer" aria-label={`Ouverture de l'épreuve « ${examName} »`}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Sunrise className="h-4 w-4 text-brand" aria-hidden="true" />
              {targetLabel}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <CountdownUnit value={parts.days} label="Jours" className={TONE_STYLES[tone].digits} />
              <CountdownUnit value={parts.hours} label="Heures" className={TONE_STYLES[tone].digits} />
              <CountdownUnit value={parts.minutes} label="Min" className={TONE_STYLES[tone].digits} />
              <CountdownUnit value={parts.seconds} label="Sec" className={TONE_STYLES[tone].digits} />
            </div>
            {/* Zone live : polie et limitée au changement de minute. */}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {announcement}
            </p>
          </div>
        ) : (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
          >
            <Play className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <p className="text-sm font-semibold text-emerald-900">
              L&apos;épreuve est ouverte. Vous pouvez la démarrer depuis votre espace
              candidat.
            </p>
          </div>
        )}

        {/* Horaires : toujours en Africa/Porto-Novo, jamais en heure de machine. */}
        <dl className="grid gap-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
          {schedule.opensAt && (
            <div className="flex items-start gap-2">
              <Sunrise className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Ouverture
                </dt>
                <dd className="font-semibold text-slate-700">
                  {formatAppDate(schedule.opensAt)}
                  <span className="ml-1.5 text-xs font-medium text-slate-400">
                    à minuit
                  </span>
                </dd>
              </div>
            </div>
          )}
          {schedule.startsAt && (
            <div className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Début prévu
                </dt>
                <dd className="font-semibold text-slate-700">
                  {formatAppDateTime(schedule.startsAt)}
                </dd>
              </div>
            </div>
          )}
          {schedule.revealDetails && durationLabel && (
            <div className="flex items-start gap-2">
              <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Durée
                </dt>
                <dd className="font-semibold text-slate-700">{durationLabel}</dd>
              </div>
            </div>
          )}
        </dl>

        <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
          Horaires affichés en {APP_TIMEZONE_LABEL}
        </p>

        {/* Action. Le lien n'existe qu'une fois le démarrage autorisé : le DOM
            ne doit jamais contenir `/exams/{id}` pour un examen verrouillé. */}
        <div className="border-t pt-4">
          {schedule.canStart ? (
            // Un lien, PAS un bouton imbriqué dans un lien : imbriquer deux
            // éléments interactifs produit un nœud que le clavier ne sait pas
            // focuser et que VoiceOver annonce deux fois. Le style vient de
            // `buttonVariants`, la sémantique du lien.
            <Link
              href={`/exams/${examId}`}
              className={buttonVariants({
                className:
                  "h-12 w-full gap-2 rounded-xl bg-brand font-bold text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand-dark",
              })}
              // Le titre seul est ambigu : on nomme l'épreuve visée.
              aria-label={`Commencer l'épreuve « ${examName} »`}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Commencer maintenant
            </Link>
          ) : (
            <Button
              disabled
              aria-describedby={`locked-${examId}`}
              className="h-12 w-full cursor-not-allowed gap-2 rounded-xl border-none bg-slate-100 font-bold text-slate-400 shadow-none"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Accès verrouillé
            </Button>
          )}
        </div>

        {/* Pourquoi c'est verrouillé — un bouton désactivé seul n'explique rien. */}
        {!schedule.canStart && (
          <p id={`locked-${examId}`} className="text-xs leading-relaxed text-slate-500">
            {schedule.phase === "ANNOUNCED" ? (
              <>
                L&apos;épreuve est visible mais le démarrage est réservé à l&apos;heure
                prévue du{" "}
                <strong className="font-bold text-slate-700">
                  {schedule.startsAt ? formatAppLongDate(schedule.startsAt) : "jour J"}
                </strong>
                .
              </>
            ) : schedule.opensAt ? (
              <>
                Le contenu se débloque le{" "}
                <strong className="font-bold text-slate-700">
                  {formatAppLongDate(schedule.opensAt)}
                </strong>{" "}
                à minuit ({APP_TIMEZONE_LABEL}).
              </>
            ) : (
              "Date d’ouverture à confirmer."
            )}
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * Version compacte pour les lignes de tableau et les pastilles de nav.
 *
 * Elle n'affiche QUE « J-2 », « 4h » : un compte à rebours complet dans une
 * ligne de tableau est illisible, et le détail appartient à la carte.
 */
export function MiniCountdown({
  scheduledAt,
  opensOn,
  isAvailable,
}: Pick<CountdownTimerProps, "scheduledAt" | "opensOn" | "isAvailable">) {
  const now = useMemo(() => new Date(), []);
  const schedule = useMemo(
    () => getScheduleView({ scheduledAt, opensOn, isAvailable }, now),
    [scheduledAt, opensOn, isAvailable, now],
  );
  const parts = useCountdown(schedule.countdownTarget, now);

  if (schedule.phase === "STARTABLE" || !parts || parts.isPast) return null;

  const label =
    parts.days > 0
      ? `J-${parts.days} ${parts.hours}h`
      : parts.hours > 0
        ? `${parts.hours}h ${parts.minutes}m`
        : `${parts.minutes}min`;

  return (
    <span
      className="font-mono text-sm font-bold text-brand"
      title={`${schedule.phase === "ANNOUNCED" ? "Début" : "Ouverture"} dans ${label}`}
    >
      {schedule.phase === "ANNOUNCED" ? "début " : "J-"}
      {label}
    </span>
  );
}
