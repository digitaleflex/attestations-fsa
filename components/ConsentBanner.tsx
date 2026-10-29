"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildRegistrationConsents } from "@/lib/consent-types";

/**
 * Bandeau de régularisation des consentements (comptes créés avant #153).
 *
 * Clickwrap, comme à l'inscription : aucune case à cocher. Le clic sur
 * « J'ai compris » vaut acceptation des CGU, de la politique de
 * confidentialité et du traitement des données — horodaté, versionné et
 * conservé côté serveur (IP + user-agent, via `/api/user/after-signup`).
 * Le marketing reste désactivé : c'est un opt-in, modifiable ensuite
 * depuis le profil (rubrique « Mes données »).
 */
export function ConsentBanner() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["user-consents"],
    queryFn: async () => {
      const res = await fetch("/api/user/consent");
      if (!res.ok) throw new Error("consents indisponibles");
      return res.json() as Promise<{ requiredComplete: boolean }>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading || dismissed || data?.requiredComplete) return null;

  const handleAccept = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/after-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consents: buildRegistrationConsents(false) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDismissed(true);
      queryClient.invalidateQueries({ queryKey: ["user-consents"] });
      toast.success("Merci ! Vos préférences ont été enregistrées.");
    } catch {
      toast.error("Enregistrement impossible pour le moment. Réessayez plus tard.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Acceptation des conditions d'utilisation"
      className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/5 p-4 sm:flex-row sm:items-center md:p-5"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-slate-700">
          En cliquant sur « J&apos;ai compris », vous acceptez nos{" "}
          <Link href="/legal/cgu" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 hover:text-brand">
            conditions générales d&apos;utilisation
          </Link>{" "}
          et notre{" "}
          <Link href="/legal/confidentialite" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 hover:text-brand">
            politique de confidentialité
          </Link>
          , ainsi que le traitement de vos données pour votre compte, votre formation et vos attestations.
        </p>
      </div>
      <Button onClick={handleAccept} disabled={saving} className="h-11 shrink-0 gap-2 bg-brand hover:bg-brand-dark sm:ml-auto">
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saving ? "Enregistrement..." : "J'ai compris"}
      </Button>
    </div>
  );
}
