import * as React from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
  className?: string;
}

/**
 * État vide partagé (admin).
 * Toujours : titre explicite + description + au moins une action de sortie.
 * Ne jamais afficher un tableau vide sans explication.
 */
export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
      >
        {icon ?? <SearchX className="h-6 w-6" />}
      </div>
      <p className="text-base font-bold text-slate-800">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-slate-600">{description}</p>
      ) : null}
      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          {primaryAction && (
            <Button onClick={primaryAction.onClick} className="min-h-[44px]">
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              className="min-h-[44px]"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
