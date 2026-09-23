import { Ban, CheckCircle2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type BulkKind = "suspend" | "reactivate" | "delete";

export interface UsersBulkBarProps {
  count: number;
  busy: BulkKind | null;
  onAction: (kind: BulkKind) => void;
  onClear: () => void;
}

/**
 * Barre d'actions groupées (sélection tableau/cards).
 * Flottante bas d'écran, rôle region, compteur en aria-live.
 * Toutes les actions destructrices passent par confirmation (parent).
 */
export function UsersBulkBar({ count, busy, onAction, onClear }: UsersBulkBarProps) {
  if (count === 0) return null;

  const disabled = busy !== null;

  return (
    <div
      role="region"
      aria-label="Actions groupées"
      className="fixed inset-x-4 bottom-4 z-30 mx-auto w-fit max-w-[calc(100vw-2rem)] sm:bottom-6"
    >
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur">
        <span aria-live="polite" className="px-2 text-xs font-black uppercase tracking-wider text-slate-700">
          {count} sélectionné{count > 1 ? "s" : ""}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onAction("suspend")}
          aria-label={`Suspendre ${count} utilisateur${count > 1 ? "s" : ""}`}
          className="min-h-[44px] gap-2 text-xs font-bold"
        >
          <Ban className="h-4 w-4 text-amber-600" aria-hidden="true" />
          Suspendre
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onAction("reactivate")}
          aria-label={`Réactiver ${count} utilisateur${count > 1 ? "s" : ""}`}
          className="min-h-[44px] gap-2 text-xs font-bold"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Réactiver
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onAction("delete")}
          aria-label={`Supprimer ${count} utilisateur${count > 1 ? "s" : ""}`}
          className="min-h-[44px] gap-2 border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {busy === "delete" ? "..." : "Supprimer"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={onClear}
          aria-label="Effacer la sélection"
          className="h-11 w-11"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
