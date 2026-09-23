import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * État d'erreur partagé (admin).
 * Message générique côté UI (jamais d'erreur brute backend),
 * détails techniques réservés aux logs (console).
 */
export function ErrorState({
  title = "Impossible de charger les données",
  description = "Une erreur est survenue lors du chargement. Vérifiez votre connexion puis réessayez.",
  onRetry,
  retryLabel = "Réessayer",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"
      >
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-base font-bold text-slate-800">{title}</p>
      <p className="max-w-sm text-sm text-slate-600">{description}</p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-2 min-h-[44px]"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
