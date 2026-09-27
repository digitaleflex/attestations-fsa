"use client";

import * as React from "react";
import { AlertCircle, Ban, Loader2, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Reprend la contrainte serveur : `parseLifecycleReason` refuse en dessous. */
const MIN_REASON_LENGTH = 5;

export interface SoftDeleteTarget {
  id: string;
  code?: string;
  fullName?: string;
  status?: string;
}

export interface SoftDeleteResult {
  /** Identifiant de l'attestation retirée, pour le retrait local de la ligne. */
  id: string;
  /** Vrai si le serveur a en plus basculé l'attestation en révocation publique. */
  revoked: boolean;
}

export interface SoftDeleteAttestationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cible de la suppression ; `null` ferme le dialogue sans appel réseau. */
  attestation: SoftDeleteTarget | null;
  /** Rappelée après une suppression logique confirmée par le serveur. */
  onDeleted?: (result: SoftDeleteResult) => void;
}

interface SoftDeleteResponse {
  softDeleted?: boolean;
  physicalDelete?: boolean;
  revoked?: boolean;
}

/**
 * Codes métier du cycle de vie (voir `lib/attestations/lifecycle.ts`) traduits
 * en une consigne actionnable. Aucun code brut n'est affiché à l'opérateur : on
 * lui dit ce qu'il peut faire, pas ce que la machine a refusé.
 */
const SERVER_ERRORS: Record<string, { title: string; description: string }> = {
  MOTIF_REQUIS: {
    title: "Motif obligatoire",
    description:
      "Le serveur a refusé l'opération : la suppression logique exige un motif d'au moins 5 caractères. Complétez-le puis relancez.",
  },
  ATTESTATION_PHYSICAL_DELETE_REFUSED: {
    title: "Suppression physique refusée",
    description:
      "La suppression physique d'une attestation émise est interdite : elle reste un document probant (PDF, hash, sceau, audit). Passez par la suppression logique avec motif, ci-dessus.",
  },
  ATTESTATION_ALREADY_SOFT_DELETED: {
    title: "Déjà supprimée logiquement",
    description:
      "Cette attestation a déjà été retirée du vérificateur par une suppression logique antérieure. Aucune nouvelle action n'est possible : consultez le journal d'audit.",
  },
};

const FALLBACK_ERROR = {
  title: "Suppression impossible",
  description:
    "L'opération n'a pas abouti. L'attestation est inchangée. Réessayez, ou vérifiez votre session administrateur.",
};

/** Une attestation « émise » reste vérifiable publiquement : la nuance compte. */
function isIssued(status?: string): boolean {
  return status === "VALIDATED" || status === "CLAIMED";
}

/**
 * Confirmation de suppression LOGIQUE avec motif obligatoire.
 *
 * Ce dialogue remplace une confirmation « Irréversible / Supprimer
 * définitivement » qui ne corresponded plus à rien : l'endpoint DELETE est
 * désormais un archivage tracé — le PDF, le hash, le sceau, le code et le
 * journal d'audit sont intacts, seule l'attestation sort du vérificateur
 * public (et bascule en révocation publique si elle était émise).
 *
 * Il rend aussi explicite l'alternative « révoquer », souvent confondue avec
 * « supprimer » : la révocation laisse le document visible et opposable comme
 * preuve d'une annulation ; la suppression logique le retire de la vue publique.
 */
export function SoftDeleteAttestationDialog({
  open,
  onOpenChange,
  attestation,
  onDeleted,
}: SoftDeleteAttestationDialogProps) {
  const [reason, setReason] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<{
    title: string;
    description: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const trimmed = reason.trim();
  const isTooShort = trimmed.length < MIN_REASON_LENGTH;
  const issued = isIssued(attestation?.status);

  const reset = React.useCallback(() => {
    setReason("");
    setFieldError(null);
    setServerError(null);
    setIsSubmitting(false);
  }, []);

  // Le champ de motif est le seul point d'entrée : il reçoit le focus à
  // l'ouverture (les lecteurs d'écran annoncent alors le titre, la description
  // et le champ dans le bon ordre), et le motif d'une suppression antérieure ne
  // resurgit jamais par surprise.
  React.useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, reset]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attestation || isSubmitting) return;

    if (isTooShort) {
      setFieldError(
        `Motif trop court : ${MIN_REASON_LENGTH} caractères minimum, ${trimmed.length} saisi${
          trimmed.length > 1 ? "s" : ""
        }.`,
      );
      textareaRef.current?.focus();
      return;
    }

    setFieldError(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      const result = await apiFetch<SoftDeleteResponse>(
        `/api/attestations/${attestation.id}`,
        { method: "DELETE", body: JSON.stringify({ reason: trimmed }) },
        false, // l'erreur est rendue dans le dialogue, pas dans un toast doublon
      );

      const revoked = Boolean(result.revoked);
      const id = attestation.id;
      toast.success("Attestation supprimée (logique)", {
        description: revoked
          ? "Elle était émise : elle est en outre marquée comme révoquée publiquement. Le PDF, le sceau et l'audit sont conservés."
          : "Elle disparaît du vérificateur public. Le PDF, le sceau et le journal d'audit sont conservés.",
      });

      onDeleted?.({ id, revoked });
      onOpenChange(false);
      reset();
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(
          SERVER_ERRORS[error.code ?? ""] ??
            (error.status === 401
              ? {
                  title: "Session expirée",
                  description:
                    "Vos droits administrateur n'ont pas été reconnus. Reconnectez-vous, puis relancez la suppression.",
                }
              : FALLBACK_ERROR),
        );
      } else {
        setServerError(FALLBACK_ERROR);
      }
      textareaRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl rounded-3xl sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-xl">
            <Trash2 className="w-6 h-6" aria-hidden="true" />
            Supprimer logiquement cette attestation
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600 text-sm leading-relaxed font-medium">
            {attestation?.code ? (
              <>
                <span className="font-mono font-bold text-slate-800">{attestation.code}</span>
                {attestation.fullName ? (
                  <span className="text-slate-500"> — {attestation.fullName}</span>
                ) : null}
                <br />
              </>
            ) : null}
            Le document n&apos;est pas effacé : il est retiré du vérificateur public et archivé
            avec le motif ci-dessous. PDF, hash, sceau, code et journal d&apos;audit restent
            intacts.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Deux intentions voisines, jamais confondues : on dit ce que chacune
            fait réellement de la visibilité publique du document. */}
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Effets des actions sur la visibilité publique">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-700">
              <Ban className="w-3.5 h-3.5" aria-hidden="true" />
              Révoquer
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              L&apos;attestation <strong>reste visible et vérifiable</strong>, marquée
              «&nbsp;révoquée&nbsp;». Pour une erreur de délivrance.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-700">
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Supprimer logiquement
              <span className="ml-auto rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white tracking-normal">
                CETTE ACTION
              </span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-rose-900">
              L&apos;attestation <strong>disparaît du vérificateur</strong>. La preuve reste
              archivée et traçable.
            </p>
          </div>
        </div>

        {issued ? (
          <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            <XCircle className="w-4 h-4 mt-px shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              Cette attestation est émise : elle sera en outre <strong>révoquée publiquement</strong>{" "}
              (statut, date, auteur, motif).
            </span>
          </p>
        ) : null}

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="attestation-soft-delete-reason" className="font-bold text-slate-700">
              Motif de suppression (obligatoire)
            </Label>
            <Textarea
              id="attestation-soft-delete-reason"
              ref={textareaRef}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (fieldError) setFieldError(null);
              }}
              onKeyDown={(event) => {
                // Entrée = nouvelle ligne dans un motif ; Ctrl/Cmd + Entrée valide.
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              rows={3}
              autoFocus
              disabled={isSubmitting}
              placeholder="Ex : doublon de la ligne AB-1234, erreur de saisie du nom à la source."
              aria-describedby={
                fieldError
                  ? "attestation-soft-delete-reason-hint attestation-soft-delete-reason-error"
                  : "attestation-soft-delete-reason-hint"
              }
              aria-invalid={fieldError ? true : undefined}
              className={cn(
                "resize-y min-h-[88px]",
                fieldError && "border-rose-300 focus-visible:ring-rose-500",
              )}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id="attestation-soft-delete-reason-hint" className="text-xs text-slate-500">
                {MIN_REASON_LENGTH} caractères minimum. Conservé dans le journal d&apos;audit ·
                Ctrl&nbsp;+&nbsp;Entrée pour valider.
              </p>
              <p
                className={cn(
                  "text-xs font-bold tabular-nums",
                  isTooShort ? "text-slate-400" : "text-emerald-600",
                )}
              >
                {trimmed.length}/{MIN_REASON_LENGTH}
              </p>
            </div>
            {fieldError ? (
              <p
                id="attestation-soft-delete-reason-error"
                role="alert"
                className="flex items-center gap-1.5 text-xs font-bold text-rose-600"
              >
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {fieldError}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              <div>
                <AlertTitle>{serverError.title}</AlertTitle>
                <AlertDescription className="text-rose-700/90">
                  {serverError.description}
                </AlertDescription>
              </div>
            </Alert>
          ) : null}

          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel
              disabled={isSubmitting}
              className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl min-h-[44px]"
            >
              Annuler
            </AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting || isTooShort}
              aria-busy={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 font-bold rounded-xl min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Suppression en cours…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  Supprimer logiquement
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
