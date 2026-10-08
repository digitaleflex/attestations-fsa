import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const FIELD_INPUT_CLASS =
  "h-12 rounded-xl border-slate-200 bg-white text-base font-medium text-slate-900 shadow-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20";

/**
 * Champ de formulaire avec label visible et erreur associée (#357, #355).
 * L'erreur est reliée via `aria-describedby` + `aria-invalid` posés
 * par l'appelant sur le contrôle (ne pas régresser l'a11y livrée).
 */
export function FormField({
  id,
  label,
  error,
  errorId,
  hint,
  children,
  centerLabel = false,
}: {
  id: string;
  label: string;
  error?: string;
  errorId?: string;
  hint?: ReactNode;
  children: ReactNode;
  centerLabel?: boolean;
}) {
  const describedBy = error && errorId ? errorId : undefined;
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        id={`${id}-label`}
        className={cn(
          "text-sm font-semibold text-slate-700",
          centerLabel && "block text-center",
        )}
      >
        {label}
      </Label>
      {/* `data-describedby` propage l'id au contrôle sans le forcer. */}
      <div data-describedby={describedBy}>{children}</div>
      {hint && !error && (
        <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
      )}
      {error && (
        <p
          id={errorId ?? `${id}-error`}
          role="alert"
          className="text-xs font-medium leading-relaxed text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
