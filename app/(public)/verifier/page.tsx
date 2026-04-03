"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, XCircle, Sparkles, Loader2 } from "lucide-react";
import CertificateTemplate from "@/components/CertificateTemplate";
import { useQuery } from "@tanstack/react-query";
// Confetti simple (SVG fallback)

const schema = z.object({
  code: z.string().min(5, "Minimum 5 caractères requis").max(64, "Code trop long")
});

type FormData = z.infer<typeof schema>;

// Définition du type Attestation pour le typage strict

type AttestationStatus = "PENDING" | "VALIDATED" | "REJECTED";
type AttestationType = "FORMATION" | "STAGE" | "CERTIFICATION";

interface Attestation {
  fullName: string;
  type: AttestationType;
  status: AttestationStatus;
  startDate: string;
  endDate: string;
  location: string;
  instructor: string;
  formation?: {
    name?: string;
    category?: string;
  };
}

function VerifierContent() {
  const [result, setResult] = useState<Attestation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code");

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch("/api/public/settings");
      if (!res.ok) return null;
      return res.json();
    }
  });

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    setResult(null);
    setShowConfetti(false);
    try {
      const res = await fetch(`/api/verifier?code=${encodeURIComponent(data.code)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur serveur");
      }
      const { attestation }: { attestation: Attestation } = await res.json();
      setResult(attestation);
      setTimeout(() => setShowConfetti(true), 200); // petit délai pour l'effet
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message || "Erreur inconnue");
      } else {
        setError("Erreur inconnue");
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-trigger if code is in URL
  useEffect(() => {
    if (codeParam) {
      setValue("code", codeParam);
      onSubmit({ code: codeParam });
    }
  }, [codeParam, setValue]);

  useEffect(() => {
    if (showConfetti) {
      const timeout = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [showConfetti]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-xl mx-auto bg-white/60 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl p-8 flex flex-col items-center animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-8 h-8 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Vérifier une Attestation</h1>
        </div>
        {/* Formulaire */}
        <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4 mb-6">
          <label htmlFor="code" className="text-sm font-medium text-gray-700">Code d'attestation</label>
          <input
            id="code"
            type="text"
            placeholder="3f8b6 ou FSA-2025-M07-00001-3f8b6"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-lg bg-white/80 backdrop-blur"
            {...register("code")}
            autoComplete="off"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">Vous pouvez saisir les 5 derniers caractères du code ou le code complet.</p>
          {errors.code && <span className="text-red-600 text-sm">{errors.code.message}</span>}
          <button
            type="submit"
            className="w-full py-3 mt-2 rounded-lg bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold text-lg shadow-lg hover:scale-105 hover:shadow-2xl focus:scale-105 transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Vérifier"}
          </button>
        </form>
        {/* Résultat */}
        {result && (
          (() => {
            let color = "green";
            let message = "Attestation validée";
            let subtitle = "Félicitations !";
            let badgeClass = "bg-green-600";
            let textClass = "text-green-900";
            let borderClass = "border-green-200";
            let infoClass = "text-green-700";
            if (result.status === "PENDING") {
              color = "yellow";
              message = "Attestation en attente de validation";
              subtitle = "Cette attestation n'a pas encore été validée.";
              badgeClass = "bg-yellow-500";
              textClass = "text-yellow-900";
              borderClass = "border-yellow-300";
              infoClass = "text-yellow-700";
            } else if (result.status === "REJECTED") {
              color = "red";
              message = "Attestation rejetée";
              subtitle = "Cette attestation a été refusée.";
              badgeClass = "bg-red-600";
              textClass = "text-red-900";
              borderClass = "border-red-200";
              infoClass = "text-red-700";
            }
            return (
              <div className={`w-full animate-fade-in-up rounded-xl ${borderClass} bg-white/70 backdrop-blur-md p-6 mt-2 ${textClass} relative overflow-hidden`}>
                {/* Confetti SVG simple */}
                {showConfetti && color === "green" && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 400 120" fill="none">
                    <circle cx="40" cy="30" r="6" fill="#16a34a" opacity="0.7" />
                    <circle cx="120" cy="20" r="4" fill="#facc15" opacity="0.7" />
                    <circle cx="200" cy="35" r="7" fill="#2563eb" opacity="0.7" />
                    <circle cx="300" cy="25" r="5" fill="#f59e42" opacity="0.7" />
                    <circle cx="360" cy="40" r="6" fill="#16a34a" opacity="0.7" />
                    <circle cx="80" cy="60" r="5" fill="#f59e42" opacity="0.7" />
                    <circle cx="250" cy="60" r="4" fill="#facc15" opacity="0.7" />
                    <circle cx="340" cy="70" r="6" fill="#2563eb" opacity="0.7" />
                  </svg>
                )}
                {/* Illustration de succès/attente/refus */}
                <div className="flex items-center gap-4 mb-4">
                  <svg viewBox="0 0 60 60" width={60} height={60} aria-hidden className="drop-shadow-lg">
                    <circle cx="30" cy="30" r="28" fill="#f0fdf4" stroke={color === "green" ? "#16a34a" : color === "yellow" ? "#facc15" : "#dc2626"} strokeWidth="3" />
                    <ShieldCheck x="15" y="15" width="30" height="30" color={color === "green" ? "#16a34a" : color === "yellow" ? "#facc15" : "#dc2626"} />
                    {color === "green" && <Sparkles x="38" y="10" width="16" height="16" color="#facc15" />}
                  </svg>
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full ${badgeClass} text-white text-sm font-bold animate-pulse`}>{message}</span>
                    <div className={`text-lg font-bold mt-1 ${textClass}`}>{subtitle}</div>
                  </div>
                </div>
                {/* Info de base */}
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="block text-[10px] font-black text-slate-400 uppercase">Détenteur</span>
                        <span className="font-bold text-slate-900">{result.fullName}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="block text-[10px] font-black text-slate-400 uppercase">Formation</span>
                        <span className="font-bold text-slate-900 truncate block">{result.formation?.name || '-'}</span>
                    </div>
                </div>

                {result.status === "VALIDATED" && (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest text-center italic">Aperçu officiel du document</p>
                        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-inner flex justify-center bg-slate-50 p-4">
                            <div className="scale-[0.35] origin-top mb-[-480px]">
                                <CertificateTemplate 
                                    data={{
                                        fullName: result.fullName,
                                        formationName: result.formation?.name || "Formation Professionnelle",
                                        code: codeParam || "",
                                        issuedAt: new Date().toISOString(),
                                        startDate: result.startDate,
                                        endDate: result.endDate,
                                        type: result.type
                                    }}
                                    settings={settings}
                                />
                            </div>
                        </div>
                    </div>
                )}
                
                <div className={`mt-4 ${infoClass} text-xs italic text-center`}>La Ferme St André s’engage pour la confiance et la transparence de vos parcours professionnels.</div>
              </div>
            );
          })()
        )}
        {error && (
          <div className="w-full animate-fade-in rounded-xl border border-red-200 bg-red-50 p-6 mt-2 text-red-900 flex items-center gap-2">
            <XCircle className="w-6 h-6 text-red-600" />
            <span className="font-bold">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
} 

export default function VerifierPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-green-600" /></div>}>
      <VerifierContent />
    </Suspense>
  );
}