import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicateur d'étapes « Compte → Vérification » (#357).
 * Reprend le StepIndicator local de `inscription/page.tsx`.
 */
export function StepIndicator({
  step,
  steps = ["Compte", "Vérification"],
  label = "Progression",
}: {
  step: number;
  steps?: [string, string] | string[];
  label?: string;
}) {
  return (
    <nav aria-label={label} className="mb-6">
      <ol className="flex items-center gap-2">
        {steps.map((name, i) => {
          const index = i + 1;
          const done = step > index;
          const active = step === index;
          return (
            <li
              key={name}
              aria-current={active ? "step" : undefined}
              className="flex min-w-0 items-center gap-2"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  done || active
                    ? "bg-brand text-white"
                    : "bg-slate-100 text-slate-500",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index}
              </span>
              <span
                className={cn(
                  "truncate text-xs font-semibold",
                  done || active ? "text-slate-800" : "text-slate-400",
                )}
              >
                {name}
              </span>
              {index < steps.length && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-1 h-px w-6 sm:w-10",
                    step > index ? "bg-brand" : "bg-slate-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
