"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;

/**
 * Saisie du code à 6 chiffres : 6 cases, collage du code complet,
 * saisie et correction tactiles, focus logique (#359, #360).
 * Le collage n'est jamais bloqué.
 */
export function OtpInput({
  id,
  value,
  onChange,
  disabled = false,
  hasError = false,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  describedBy?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from(
    { length: OTP_LENGTH },
    (_, i) => value[i] ?? "",
  );

  const setFrom = (next: string, focusIndex?: number) => {
    onChange(next.replace(/\D/g, "").slice(0, OTP_LENGTH));
    if (focusIndex !== undefined) {
      requestAnimationFrame(() => refs.current[focusIndex]?.focus());
    }
  };

  const handleChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const next = digits.slice();
      next[index] = "";
      onChange(next.join(""));
      return;
    }
    // Collage ou saisie rapide : répartit les chiffres depuis la case active.
    const next = digits.slice();
    for (let k = 0; k < clean.length && index + k < OTP_LENGTH; k++) {
      next[index + k] = clean[k];
    }
    const joined = next.join("");
    onChange(joined);
    const lastFilled = Math.min(index + clean.length, OTP_LENGTH - 1);
    requestAnimationFrame(() => refs.current[lastFilled]?.focus());
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      const next = digits.slice();
      next[index - 1] = "";
      setFrom(next.join(""), index - 1);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (
    index: number,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    if (!text) return;
    handleChange(index, text);
  };

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="flex items-center justify-center gap-1.5 sm:gap-2"
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={i === 0 ? id : `${id}-${i + 1}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Chiffre ${i + 1} sur ${OTP_LENGTH}`}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          value={digit}
          maxLength={OTP_LENGTH}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 w-10 rounded-xl border bg-white text-center text-lg font-bold text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-12",
            hasError
              ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200"
              : "border-slate-200 focus-visible:border-brand",
            digit && "border-slate-300 bg-slate-50",
          )}
        />
      ))}
    </div>
  );
}
