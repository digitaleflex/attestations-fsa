"use client";

import React, { useState, useEffect, Suspense } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import OfficialDocument from "@/components/OfficialDocument";
import Link from "next/link";

const schema = z.object({
  code: z.string().min(3, "Veuillez entrer au moins 3 caractères").max(64, "Code trop long")
});

type FormData = z.infer<typeof schema>;

type AttestationStatus = "PENDING" | "VALIDATED" | "REJECTED";
type AttestationType = "FORMATION" | "STAGE" | "CERTIFICATION";

interface Attestation {
  id: string;
  code: string;
  fullName: string;
  type: AttestationType;
  status: AttestationStatus;
  startDate: string;
  endDate: string;
  location: string;
  instructor: string;
  score: number;
  issuedAt: string;
  formation?: {
    name?: string;
    category?: string;
  };
}

function VerifierContent() {
  const [result, setResult] = useState<Attestation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const codeParam = searchParams ? searchParams.get("code") : null;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    if (loading) return;
    setLoading(true);
    setError("");
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
      setError(e.message || "Une erreur est survenue");
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

  const handleReset = () => {
    setResult(null);
    setError("");
    setValue("code", "");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafbfc] relative overflow-hidden p-4 md:p-8 pt-24 md:pt-32 selection:bg-brand selection:text-white w-full font-sans">
      
      {/* Arrière-plan épuré et captivant */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-30%] right-[-20%] w-[90vw] h-[90vw] bg-brand/[0.03] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-30%] left-[-20%] w-[90vw] h-[90vw] bg-blue-500/[0.03] rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-4xl mx-auto z-10 space-y-8 relative">
        <AnimatePresence mode="wait">
          {!result && !error && !loading && (
            <motion.div
              key="search-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-8 text-center"
            >
              {/* Header Ultra-minimaliste */}
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Authentifier un document
                </h1>
                <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto">
                  Entrez le code officiel de l'attestation ou son identifiant unique pour vérifier son authenticité.
                </p>
              </div>

              {/* Formulaire de recherche minimaliste */}
              <div className="relative w-full max-w-xl mx-auto">
                <div className="bg-white rounded-2xl border border-slate-200/60 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/5 transition-all duration-300">
                  <form onSubmit={handleSubmit(onSubmit)} className="flex items-center gap-2">
                    <div className="relative flex-1 flex items-center">
                      <Search className="w-5 h-5 text-slate-400 absolute left-4" />
                      <input
                        {...register("code")}
                        type="text"
                        placeholder="Ex: FSA-2026-04-00001-A3F7C..."
                        className="w-full h-12 pl-12 pr-4 bg-transparent border-none focus:ring-0 text-base font-bold tracking-wide text-slate-800 placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal"
                        autoComplete="off"
                        disabled={loading}
                      />
                    </div>
                    <Button 
                      disabled={loading}
                      type="submit"
                      className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-brand-dark text-white font-bold tracking-wide text-sm transition-all duration-300 shrink-0"
                    >
                      Vérifier
                    </Button>
                  </form>
                </div>

                {errors.code && (
                  <p className="text-rose-500 text-xs font-semibold text-left mt-2 pl-4">
                    {errors.code.message}
                  </p>
                )}

                {/* Exemples de format discrets */}
                <div className="mt-4 flex flex-col items-center gap-1.5 text-[11px] text-slate-400 font-medium tracking-wide">
                  <span className="flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-brand" />
                    Format standard : FSA-2026-04-00001-A3F7C ou le hash final (ex : A3F7C)
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-4"
            >
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
              <p className="text-sm font-semibold text-slate-400 tracking-wide uppercase">Vérification en cours...</p>
            </motion.div>
          )}

          {result && !loading && (
            <motion.div
              key="result-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 w-full max-w-4xl mx-auto"
            >
              {/* Bouton retour épuré */}
              <div className="flex justify-start">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all active:scale-95"
                >
                  ← Vérifier un autre code
                </button>
              </div>

              {/* Affichage du document officiel */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.03)] border border-slate-100">
                <OfficialDocument 
                  data={{
                    id: result.id,
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
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md mx-auto bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)]"
            >
              <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800">Aucun certificat trouvé</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Le code saisi ne correspond à aucune attestation enregistrée. Veuillez vérifier l'exactitude des caractères saisis.
                </p>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs tracking-wider uppercase transition-all active:scale-95"
                >
                  Réessayer
                </button>
                <Link href="/contact">
                  <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl font-semibold text-xs tracking-wider uppercase transition-all">
                    Support
                  </button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer épuré */}
        {!loading && (
          <div className="text-center pt-10 text-[10px] text-slate-300 font-bold uppercase tracking-[0.15em] space-y-1">
            <p>Ferme Agro-Piscicole Cité St André</p>
            <p className="font-normal text-slate-200">Données chiffrées & certifiées</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifierPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-brand" /></div>}>
      <VerifierContent />
    </Suspense>
  );
}
