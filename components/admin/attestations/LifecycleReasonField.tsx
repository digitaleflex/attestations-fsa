"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Contrainte serveur partagée par toutes les actions de cycle de vie. */
export const LIFECYCLE_REASON_MIN_LENGTH = 5;

export interface LifecycleReasonFieldProps {
  /** Identifiant du champ : relie libellé, description et message d'erreur. */
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Teinte du cadre au focus, alignée sur l'action parente. */
  tone?: "amber" | "rose";
  disabled?: boolean;
  /** Erreur Already rendered par le parent (ex. refus serveur). */
  serverError?: string | null;
}

/**
 * Champ « motif » multiligne obligatoire, partagé par les actions de cycle de
 * vie (révocation, rétrogradation, suppression logique).
 *
 * Un seul composant pour les trois : la validation de longueur, le compteur et
 * l'annonce vocale restent identiques partout, et l'opérateur qui traite une
 * série d'attestations retrouve le même geste à chaque écran.
 */
export function LifecycleReasonField({
  id,
  label,
  placeholder,
  value,
  onChange,
  tone = "rose",
  disabled = false,
  serverError = null,
}: LifecycleReasonFieldProps) {
  const [touched, setTouched] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const tooShort = trimmed.length < LIFECYCLE_REASON_MIN_LENGTH;
  const error =
    serverError ?? (touched && tooShort ? `Motif trop court : ${LIFECYCLE_REASON_MIN_LENGTH} caractères minimum.` : null);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-bold text-slate-700">
        {label}
      </Label>
      <Textarea
        id={id}
        ref={textareaRef}
        value={value}
        rows={3}
        disabled={disabled}
        autoFocus
        placeholder={placeholder}
        aria-describedby={`${id}-hint`}
        aria-invalid={error ? true : undefined}
        onBlur={() => setTouched(true)}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "resize-y min-h-[88px] text-sm",
          tone === "amber"
            ? "border-amber-200 focus-visible:border-amber-500 focus-visible:ring-amber-400"
            : "border-rose-200 focus-visible:border-rose-400 focus-visible:ring-rose-400",
          error && "border-rose-400 focus-visible:ring-rose-500",
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {LIFECYCLE_REASON_MIN_LENGTH} caractères minimum. Conservé dans le journal
          d&apos;audit.
        </p>
        <p
          className={cn(
            "text-xs font-bold tabular-nums",
            tooShort ? "text-slate-400" : "text-emerald-600",
          )}
        >
          {trimmed.length}/{LIFECYCLE_REASON_MIN_LENGTH}
        </p>
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1.5 text-xs font-bold text-rose-600"
        >
          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
