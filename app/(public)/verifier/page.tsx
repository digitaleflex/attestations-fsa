"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, XCircle, Sparkles, Loader2 } from "lucide-react";
import OfficialDocument from "@/components/OfficialDocument";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
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
  const codeParam = searchParams ? searchParams.get("code") : null;

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
  }, [showConfetti]);  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden p-4">
      {/* Elements Décoratifs Arrière-plan */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-2xl mx-auto z-20">
        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] p-10 flex flex-col items-center animate-in fade-in zoom-in duration-700">
          
          {/* Zone En-tête */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-blue-600 p-0.5 mb-8 shadow-xl shadow-emerald-500/10 group hover:rotate-6 transition-transform duration-500">
            <div className="w-full h-full bg-white rounded-[1.4rem] flex items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-emerald-500 group-hover:scale-110 transition-transform duration-500" />
            </div>
          </div>

          <div className="text-center mb-10 space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Vérification FSA</h1>
            <p className="text-slate-500 font-medium">Authentifiez instantanément un certificat officiel</p>
          </div>

          {/* Formulaire Area */}
          <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-6 mb-8 group">
            <div className="relative">
              <input
                id="code"
                type="text"
                placeholder="Ex: 3f8b6 ou FSA-2026..."
                className="relative w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-xl font-mono text-slate-900 placeholder:text-slate-400 transition-all shadow-sm"
                {...register("code")}
                autoComplete="off"
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              className="w-full py-5 rounded-2xl bg-slate-900 text-white font-black text-lg shadow-xl shadow-slate-200 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  Vérifier
                </>
              )}
            </button>
          </form>

          {/* Zone Résultats */}
          {result && (
            <div className="w-full animate-in slide-in-from-top-4 fade-in duration-500">
               <div className={`relative overflow-hidden rounded-3xl border ${result.status === 'VALIDATED' ? 'border-emerald-500/20 bg-emerald-50/50' : result.status === 'PENDING' ? 'border-amber-500/20 bg-amber-50/50' : 'border-rose-500/20 bg-rose-50/50'} p-8`}>
                  
                  {/* Status Badge Group */}
                  <div className="flex items-center gap-5 mb-8">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${result.status === 'VALIDATED' ? 'bg-emerald-500 text-white' : result.status === 'PENDING' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
                      {result.status === 'VALIDATED' ? <ShieldCheck className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                    </div>
                    <div>
                      <Badge className={`border-none px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${result.status === 'VALIDATED' ? 'bg-emerald-100 text-emerald-700' : result.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {result.status === 'VALIDATED' ? 'Attestation Authentifiée' : result.status === 'PENDING' ? 'En cours' : 'Non Authentique'}
                      </Badge>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">
                        {result.status === 'VALIDATED' ? 'Document Officiel' : result.status === 'PENDING' ? 'Dossier en traitement' : 'Document Invalide'}
                      </h3>
                    </div>
                  </div>

                  {/* Grille d'Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Candidat</span>
                        <span className="text-slate-900 font-bold">{result.fullName}</span>
                      </div>
                      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Formation</span>
                        <span className="text-slate-900 font-bold truncate block">{result.formation?.name || "Certificat FSA"}</span>
                      </div>
                  </div>

                  {/* Aperçu Certificat */}
                  {result.status === "VALIDATED" && (
                    <div className="space-y-4">
                       <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Certifié</p>
                       <div className="bg-white rounded-xl overflow-hidden shadow-2xl relative border border-slate-100">
                          <div className="scale-[0.38] origin-top mb-[-460px] opacity-95">
                              <OfficialDocument 
                                  data={{
                                      id: "verification-preview",
                                      fullName: result.fullName,
                                      formationName: result.formation?.name || "Formation",
                                      code: codeParam || "",
                                      issuedAt: new Date().toISOString(),
                                      startDate: result.startDate,
                                      endDate: result.endDate,
                                      type: result.type,
                                      status: result.status,
                                      score: 0
                                  }}
                                  hideStepper={true}
                              />
                          </div>
                       </div>
                    </div>
                  )}

                  <div className="mt-8 text-center border-t border-slate-100 pt-6">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Plateforme de confiance FSA © 2026</p>
                  </div>
               </div>
            </div>
          )}

          {error && (
            <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-500 mt-6">
               <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-rose-600 flex items-center gap-4 shadow-sm">
                  <XCircle className="w-8 h-8 shrink-0" />
                  <div className="font-bold">{error}</div>
               </div>
            </div>
          )}
        </div>
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