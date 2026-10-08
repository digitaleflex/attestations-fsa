import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Action primaire des écrans d'accès : une seule par écran,
 * hauteur ≥ 48 px (#357, #360).
 */
export function SubmitButton({
  loading,
  loadingLabel,
  children,
  disabled,
}: {
  loading: boolean;
  loadingLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-white shadow-none transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
