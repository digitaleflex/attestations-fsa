import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Message de formulaire : erreur, information ou succès (#357, #355).
 * Erreurs annoncées via `role="alert"`, succès via `role="status"`.
 * Le sens ne repose jamais sur la couleur seule (icône + titre).
 */
export function FormAlert({
  variant,
  title,
  children,
}: {
  variant: "error" | "info" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const Icon =
    variant === "error"
      ? AlertCircle
      : variant === "success"
        ? CheckCircle2
        : Info;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-sm",
        variant === "error" && "border-red-200 bg-red-50 text-red-900",
        variant === "info" && "border-slate-200 bg-slate-50 text-slate-700",
        variant === "success" &&
          "border-green-200 bg-green-50 text-green-900",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          variant === "error" && "text-red-600",
          variant === "info" && "text-slate-500",
          variant === "success" && "text-green-600",
        )}
      />
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-0.5 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
