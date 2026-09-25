import * as React from "react";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   États de données de l'espace candidat (chargement / erreur / vide / score).

   Règle appliquée partout : un état vide n'est JAMAIS présenté comme une
   erreur, et une erreur réseau n'est JAMAIS présentée comme un vide. Les deux
   ont donc des composants distincts, et l'erreur propose toujours un retry.
   ──────────────────────────────────────────────────────────────────────────── */

export interface CandidateLoadingProps {
  /** Message lu par les lecteurs d'écran (« Chargement de vos attestation… »). */
  label: string;
  /** Squelettes visuels à afficher sous le message. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Chargement annoncé aux technologies d'assistance.
 *
 * `role="status"` + `aria-live="polite"` : le message est lu sans interrompre
 * la navigation, `aria-busy` signale que la zone est en cours de mise à jour.
 * Le spinner seul (sans texte) est invisible pour un lecteur d'écran : c'est
 * ce que la plupart des écrans candidats faisaient.
 */
export function CandidateLoading({
  label,
  children,
  className,
}: CandidateLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("space-y-4", className)}
    >
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-3 text-slate-600" aria-hidden="true">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      {children}
    </div>
  );
}

export interface CandidateErrorStateProps {
  /** Relance la requête (`refetch` de react-query). */
  onRetry?: () => void;
  /** `true` pendant une relance : le bouton passe en état occupé. */
  isRetrying?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Erreur de chargement — c'est-à-dire réseau / serveur, PAS « zéro résultat ».
 *
 * `role="alert"` : le contenu est annoncé dès son apparition, sans attendre.
 * Un retry est toujours proposé (bouton focusable, cible ≥ 44 px).
 */
export function CandidateErrorState({
  onRetry,
  isRetrying = false,
  title = "Impossible de charger vos données",
  description = "La connexion au serveur a échoué ou le service est momentanément indisponible. Vos données n'ont pas été modifiées.",
  className,
}: CandidateErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-3xl border border-rose-200 bg-rose-50 px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm"
      >
        <WifiOff className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-rose-900">{title}</p>
        <p className="mx-auto max-w-md text-sm text-rose-800">{description}</p>
      </div>
      {onRetry && (
        <Button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-1 min-h-[44px] gap-2 rounded-xl bg-brand font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-dark"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRetrying && "animate-spin")}
            aria-hidden="true"
          />
          {isRetrying ? "Nouvelle tentative…" : "Réessayer"}
        </Button>
      )}
    </div>
  );
}

export interface CandidateEmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * État vide — la requête a réussi, il n'y a simplement rien à afficher.
 *
 * Réutilise `EmptyState` (role="status") : aucune alerte, on explique
 * simplement la situation et on donne une sortie.
 */
export function CandidateEmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: CandidateEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={icon}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      className={cn(
        "rounded-3xl border border-dashed border-slate-300 bg-white",
        className,
      )}
    />
  );
}

export interface ScoreProgressBarProps {
  /** Progression en pourcentage, bornée à [0, 100]. */
  value: number;
  /** Nom lisible de la barre : « Progression globale », « Partie 1 »… */
  label: string;
  /** Couleur de l'indicateur (défaut : dégradé de marque). */
  indicatorClassName?: string;
  className?: string;
  /** Hauteur de la piste (`h-2.5`, `h-1.5`…). */
  trackClassName?: string;
}

/**
 * Barre de progression de score, exposée comme `progressbar`.
 *
 * Une barre purely décorative est inaudible : sans `aria-valuenow`, un lecteur
 * d'écran annonce « 0 % » quel que soit le score réel. On expose donc la
 * borne, la valeur courante, et un `aria-valuetext` en français lisible.
 */
export function ScoreProgressBar({
  value,
  label,
  indicatorClassName = "bg-gradient-to-r from-brand to-brand-dark",
  className,
  trackClassName = "h-2.5",
}: ScoreProgressBarProps) {
  const safeValue = Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      aria-valuetext={`${safeValue} %`}
      className={cn(
        "w-full overflow-hidden rounded-full bg-slate-200",
        trackClassName,
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "h-full rounded-full transition-all duration-1000",
          indicatorClassName,
        )}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
