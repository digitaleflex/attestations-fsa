"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  XCircle, 
  Loader2, 
  Search, 
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { div as MotionDiv } from "framer-motion/client";
import { AnimatePresence } from "@/lib/framer-motion-client";
import OfficialDocument from "@/components/OfficialDocument";
import Link from "next/link";

const schema = z.object({
  code: z.string().min(3, "Veuillez entrer au moins 3 caractères").max(64, "Code trop long")
});

type FormData = z.infer<typeof schema>;

type AttestationStatus = "VALIDATED" | "CLAIMED" | "REJECTED" | "REVOKED";
type AttestationType = "FORMATION" | "STAGE" | "CERTIFICATION";

interface AttestationProof {
  revoked: boolean;
  reason?: string | null;
}

// #281 — la réponse publique est une WHITELIST stricte. Ce type doit refléter
// EXACTEMENT ce que la route publie aujourd'hui : `location` et `instructor`
// n'en font plus partie (retirés de la whitelist #281) et n'ont jamais été
// affichés ci-dessous. Les déclarer ici faisait croire à un contrat que
// l'API ne tient pas — et aurait autorisé un jour un `...result` capable
// de les republier.
//
// Le cuid interne `id` a été retiré de la whitelist : il n'est ni utile ni
// justifié pour un tiers. `<OfficialDocument>` se passe de lui (empreinte
// rattachée au `code`, pied de document sans identifiant interne), donc ce
// type ne le déclare plus — sans quoi il ferait croire que l'API le publie.
interface PublishedAttestation {
  code: string;
  fullName: string;
  type: AttestationType;
  status: Exclude<AttestationStatus, "REJECTED" | "REVOKED">;
  startDate: string;
  endDate: string;
  score: number;
  issuedAt: string;
  proof: AttestationProof;
  formation?: {
    name?: string;
    category?: string;
  } | null;
}

interface RevokedAttestation {
  code: string;
  // #299/#301 — une révocation publique porte désormais le statut `REVOKED`
  // (distinct de `REJECTED`, qui reste un refus d'émission). Les deux sont
  // affichés par la même carte « révoquée » : le tiers vérifie une révocation,
  // jamais un certificat valide.
  status: "REJECTED" | "REVOKED";
  proof: AttestationProof & { revoked: true };
}

type Attestation = PublishedAttestation | RevokedAttestation;

function isRevokedAttestation(attestation: Attestation): attestation is RevokedAttestation {
  return "proof" in attestation && attestation.proof.revoked;
}

function VerifierContent() {
  const [result, setResult] = useState<Attestation | null>(null);
  const [error, setError] = useState("");
  const [isTechnicalError, setIsTechnicalError] = useState(false);
  const [loading, setLoading] = useState(false);
  const validationSummaryRef = useRef<HTMLDivElement>(null);
  const networkErrorRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const codeParam = searchParams ? searchParams.get("code") : null;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    if (loading) return;
    setLoading(true);
    setError("");
    setIsTechnicalError(false);
    setResult(null);
    try {
      const res = await fetch(`/api/verifier?code=${encodeURIComponent(data.code.trim())}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Aucun certificat trouvé");
      }
      const { attestation }: { attestation: Attestation } = await res.json();
      setResult(attestation);
    } catch (e: any) {
      // La requête n'a jamais abouti (connexion coupée, service injoignable) :
      // c'est un état « vérification impossible », distinct du « code
      // introuvable » renvoyé par l'API.
      if (e instanceof TypeError) {
        setIsTechnicalError(true);
        setError("La vérification n’a pas pu aboutir. Vérifiez votre connexion puis réessayez.");
      } else {
        setError(e.message || "Une erreur est survenue");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (codeParam) {
      setValue("code", codeParam);
      onSubmit({ code: codeParam });
    }
  }, [codeParam, setValue]);

  useEffect(() => {
    if (errors.code) validationSummaryRef.current?.focus();
  }, [errors.code]);

  useEffect(() => {
    if (error) networkErrorRef.current?.focus();
  }, [error]);

  const handleReset = () => {
    setResult(null);
    setError("");
    setIsTechnicalError(false);
    setValue("code", "");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white relative overflow-hidden p-4 md:p-8 pt-24 md:pt-32 selection:bg-brand selection:text-white w-full font-sans">
      
      {/* Arrière-plan épuré */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-30%] right-[-20%] w-[90vw] h-[90vw] bg-brand/[0.04] rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-4xl mx-auto z-10 space-y-8 relative">
        <AnimatePresence mode="wait">
          {!result && !error && !loading && (
            <MotionDiv
              key="search-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-8 text-center"
            >
              {/* Header */}
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-ink tracking-tight">
                  Vérifier une attestation
                </h1>
                <p className="text-brand-muted text-sm md:text-base max-w-md mx-auto">
                  Entrez le code officiel imprimé sur l&apos;attestation pour vérifier son authenticité.
                </p>
              </div>

              {/* Formulaire de recherche minimaliste */}
              <div className="relative w-full max-w-xl mx-auto">
                <div className={`bg-white rounded-2xl border p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] focus-within:ring-4 transition-all duration-300 ${errors.code ? "border-rose-500 focus-within:ring-rose-100" : "border-brand-line focus-within:border-brand focus-within:ring-brand/10"}`}>
                  <label htmlFor="verification-code" className="sr-only">Code de l’attestation</label>
                  <form onSubmit={handleSubmit(onSubmit)} className="flex items-center gap-2" aria-busy={loading}>
                    <div className="relative flex-1 flex items-center">
                      <Search aria-hidden="true" className="w-5 h-5 text-brand-muted absolute left-4" />
                      <input
                        {...register("code")}
                        id="verification-code"
                        type="text"
                        placeholder="Ex: FSA-2026-M01-00042-f0f9a"
                        className="w-full h-12 pl-12 pr-4 bg-transparent border-none rounded-lg text-base font-bold tracking-wide text-brand-ink placeholder:text-brand-muted placeholder:font-normal placeholder:tracking-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                        autoComplete="off"
                        disabled={loading}
                        aria-invalid={Boolean(errors.code)}
                        aria-describedby={errors.code ? "verification-code-error" : undefined}
                      />
                    </div>
                    <Button 
                      disabled={loading}
                      type="submit"
                      className="h-11 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold tracking-wide text-sm transition-all duration-300 shrink-0"
                    >
                      Vérifier
                    </Button>
                  </form>
                </div>

                {errors.code && (
                  <div className="text-left mt-3 space-y-2">
                    <div
                      ref={validationSummaryRef}
                      role="alert"
                      tabIndex={-1}
                      className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2"
                    >
                      Le code saisi contient une erreur : {errors.code.message}
                    </div>
                    <p id="verification-code-error" className="sr-only">{errors.code.message}</p>
                  </div>
                )}

                {/* Exemples de format discrets
                    Un SEUL mode de saisie existe : le code FSA complet.
                    `/api/verifier` compare le paramètre `code` par ÉGALITÉ
                    stricte depuis le début (`code: { equals: validCode }`) :
                    aucun fragment, aucun « hash final » n'a jamais été accepté.
                    L'exemple suit la forme réellement émise par
                    `lib/attestations/issue.ts` — `FSA-<année>-M<mois>-<séquence
                    sur 5 chiffres>-<5 caractères>` (REFERENCE_CODE_PATTERN). */}
                <div className="mt-4 flex flex-col items-center gap-1.5 text-[11px] text-brand-muted font-medium tracking-wide">
                  <span className="flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-brand" />
                    Format standard : FSA-2026-M01-00042-f0f9a
                  </span>
                </div>

                {/* Ce que la vérification confirme — et ne confirme pas (#343) */}
                <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-brand-line bg-white p-5 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">
                    Ce que la vérification confirme
                  </p>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-brand-ink">
                    Le code correspond à une attestation émise par la FSA et
                    indique si elle est toujours valable.
                  </p>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">
                    Ce qu’elle ne confirme pas
                  </p>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-brand-ink">
                    Ni l’identité de la personne qui présente le document, ni
                    le détail du parcours suivi.
                  </p>
                </div>
              </div>
            </MotionDiv>
          )}

          {loading && (
            <MotionDiv
              key="loading-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-4"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-brand" />
              <p className="text-sm font-semibold text-brand-muted tracking-wide uppercase">Vérification en cours...</p>
            </MotionDiv>
          )}

          {result && !loading && (
            <MotionDiv
              key="result-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 w-full max-w-4xl mx-auto"
            >
              {/* Bouton retour */}
              <div className="flex justify-start">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-muted hover:text-brand-ink bg-white border border-brand-line rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-95"
                >
                  ← Vérifier un autre code
                </button>
              </div>

              {isRevokedAttestation(result) ? (
                <div className="bg-white rounded-3xl border border-rose-100 p-8 text-center space-y-3">
                  <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
                  <h2 className="text-xl font-bold text-brand-ink">Attestation révoquée</h2>
                  <p className="text-sm text-brand-muted">
                    {result.proof.reason || "Cette attestation n'est plus valable."}
                  </p>
                  <p className="text-xs font-mono text-brand-muted">{result.code}</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.03)] border border-brand-line">
                  <OfficialDocument
                    data={{
                      code: result.code,
                      fullName: result.fullName,
                      formationName: result.formation?.name || "Formation",
                      type: result.type,
                      startDate: result.startDate,
                      endDate: result.endDate,
                      score: result.score,
                      status: result.status,
                      issuedAt: result.issuedAt
                    }}
                    hideStepper={true}
                  />
                </div>
              )}
            </MotionDiv>
          )}

          {error && !loading && (
            <MotionDiv
              key="error-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              ref={networkErrorRef}
              role="alert"
              tabIndex={-1}
              className="w-full max-w-md mx-auto bg-white border border-rose-300 rounded-2xl p-8 text-center space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2"
            >
              <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-brand-ink">
                  {isTechnicalError ? "Vérification impossible" : "Aucun certificat trouvé"}
                </h3>
                <p className="text-brand-muted text-sm leading-relaxed">
                  {error || "Le code saisi ne correspond à aucune attestation enregistrée. Veuillez vérifier l’exactitude des caractères saisis."}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl font-semibold text-xs tracking-wider uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-95"
                >
                  Réessayer
                </button>
                <Link
                  href="/contact"
                  className="text-xs font-bold text-brand-muted underline-offset-4 transition hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Contacter le support
                </Link>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Footer */}
        {!loading && (
          <div className="text-center pt-10 text-[10px] text-brand-muted/70 font-bold uppercase tracking-[0.15em] space-y-1">
            <p>Ferme Agro-Piscicole Cité St André</p>
            <p className="font-normal text-brand-muted/60">Données chiffrées & certifiées</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifierPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center gap-3" role="status" aria-live="polite" aria-busy="true"><Loader2 aria-hidden="true" className="w-12 h-12 animate-spin text-brand" /><p className="text-sm font-semibold text-brand-muted">Chargement du vérificateur…</p></div>}>
      <VerifierContent />
    </Suspense>
  );
}
