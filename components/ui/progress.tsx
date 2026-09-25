"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

// Radix pose déjà `role="progressbar"` + `aria-valuemin/max/now`, mais seulement
// si `value` est fourni et si un nom accessible existe. On borne la valeur et on
// fournit un `aria-label` par défaut : une barre sans nom n'est annoncée que
// comme « barre de progression », sans dire de quoi il s'agit.
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string;
  }
>(({ className, value, max = 100, indicatorClassName, ...props }, ref) => {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Math.max(0, Math.min(safeMax, value ?? 0));
  const percent = Math.round((safeValue / safeMax) * 100);

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={safeValue}
      max={safeMax}
      aria-label={props["aria-label"] ?? "Progression"}
      aria-valuetext={`${percent} %`}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all",
          indicatorClassName || "bg-primary"
        )}
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
