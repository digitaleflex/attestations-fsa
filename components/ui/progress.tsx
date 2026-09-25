"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string
}

/**
 * Jauge de progression.
 *
 * `value` EST transmis à la racine Radix : c'est elle qui publie
 * `role="progressbar"` et `aria-valuenow` / `aria-valuemin` / `aria-valuemax`.
 * Ne pas le transmettre laisse l'indicateur visuel bouger tout en exposant une
 * jauge « indéterminée » aux technologies d'assistance — un état muet, donc
 * inexploitable.
 *
 * `value` à `null` = progression indéterminée (état Radix officiel) : la barre
 * reste visible et pleine, `aria-valuenow` est alors volontairement absent.
 *
 * Un nom accessible est obligatoire : sans `aria-label` ni `aria-labelledby`,
 * un lecteur d'écran annonce « barre de progression » sans dire ce qu'elle
 * mesure. Le prop `label` est le raccourci pour le cas courant ; à défaut, on
 * retombe sur un nom générique plutôt que de laisser la jauge anonyme — les
 * appelants qui savent nommer leur progression passent `label`.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps & {
    /** Rendu en `aria-label` — à utiliser quand aucun `<label>` visible n'existe. */
    label?: string
  }
>(
  (
    { className, value, max = 100, label, indicatorClassName, ...props },
    ref
  ) => {
    // Radix n'accepte que des nombres : on borne pour qu'une valeur aberrante
    // (division par zéro, total mal calculé) ne produise jamais un
    // `aria-valuenow` hors échelle, qui serait rejeté comme invalide.
    const bounded =
      typeof value === "number" && Number.isFinite(value)
        ? Math.min(100, Math.max(0, value))
        : null

    // `aria-valuetext` : la valeur brute n'est pas parlante. On propose un
    // pourcentage arrondi tant que l'appelant n'en fournit pas un.
    const ariaValueText =
      props["aria-valuetext"] ??
      (bounded === null ? undefined : `${Math.round(bounded)} %`)

    // Jamais de jauge anonyme : sans nom explicite, on en donne un générique.
    const accessibleName =
      label ?? props["aria-label"] ?? props["aria-labelledby"] ?? "Progression"

    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={bounded}
        max={max}
        aria-label={accessibleName}
        aria-valuetext={ariaValueText}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-full flex-1 transition-transform duration-500 ease-out",
            indicatorClassName || "bg-primary"
          )}
          // `bounded === null` : pas d'état d'avancement connu, on ne translate
          // pas (l'indicateur reste plein) au lieu de simuler un 0 % trompeur.
          style={{
            transform:
              bounded === null
                ? undefined
                : `translateX(-${100 - (bounded / max) * 100}%)`,
          }}
        />
      </ProgressPrimitive.Root>
    )
  }
)
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
