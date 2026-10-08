"use client";

import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FIELD_INPUT_CLASS } from "./FormField";
import { cn } from "@/lib/utils";

/**
 * Champ mot de passe avec bascule d'affichage accessible (#357).
 * Cible tactile ≥ 44 px, état annoncé via `aria-pressed`.
 */
export function PasswordField({
  id,
  name,
  value,
  onChange,
  placeholder = "••••••••",
  autoComplete = "current-password",
  disabled = false,
  hasError = false,
  describedBy,
  showPassword,
  onToggleVisibility,
  toggleLabel,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  hasError?: boolean;
  describedBy?: string;
  showPassword: boolean;
  onToggleVisibility: () => void;
  toggleLabel: { show: string; hide: string };
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        name={name ?? id}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={cn(FIELD_INPUT_CLASS, "pr-12", hasError && "border-red-400")}
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        aria-label={showPassword ? toggleLabel.hide : toggleLabel.show}
        aria-pressed={showPassword}
        disabled={disabled}
        className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
      >
        {showPassword ? (
          <EyeOff className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Eye className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
