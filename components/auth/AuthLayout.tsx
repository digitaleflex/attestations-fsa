import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Conteneur commun des écrans d'accès candidat (#357).
 * Mobile-first : une seule colonne, carte allégée, aucun décor
 * (halos, grilles, glassmorphism) qui occupe l'écran sur 320-414 px.
 */
export function AuthLayout({
  children,
  wide = false,
  label,
}: {
  children: ReactNode;
  /** `wide` : inscription (formulaire + panneau latéral sur desktop). */
  wide?: boolean;
  label?: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] w-full items-start justify-center bg-slate-50 px-4 py-8 sm:items-center sm:py-12">
      <Card
        aria-label={label}
        className={cn(
          "w-full border border-slate-200 bg-white shadow-sm",
          wide ? "max-w-3xl overflow-hidden p-0" : "max-w-md p-6 sm:p-8",
        )}
      >
        {children}
      </Card>
    </div>
  );
}
