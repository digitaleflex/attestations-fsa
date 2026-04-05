"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  ShieldCheck, 
  XCircle, 
  Sparkles, 
  Loader2, 
  Search, 
  ChevronRight,
  Info,
  Calendar,
  User,
  GraduationCap,
  Download,
  AlertTriangle,
  Fingerprint
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const searchParams = useSearchParams();
  const codeParam = searchParams ? searchParams.get("code") : null;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const codeValue = watch("code");

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfdfe] relative overflow-hidden p-4 md:p-10 pt-24 md:pt-36 selection:bg-emerald-100 selection:text-emerald-900 w-full font-sans">
      
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[80vw] h-[80vw] bg-emerald-400/5 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[70vw] h-[70vw] bg-blue-500/5 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-4xl mx-auto z-10 space-y-12 mb-20 relative">
        
        {/* Header */}
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center text-center space-y-8"
        >
            <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white border border-slate-100 shadow-2xl shadow-slate-200/50 text-emerald-600">
                <ShieldCheck className="w-5 h-5 fill-emerald-500" />
                <span className="text-[11px] font-black uppercase tracking-[0.25em]">Protocol de Vérification FSA</span>
            </div>
            
            <div className="space-y-4">
                <h1 className="text-5xl md:text-8xl font-black text-slate-900 leading-[0.85] tracking-tight">
                    Authentifiez <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-blue-600 animate-gradient">
                        votre certificat.
                    </span>
                </h1>
                <p className="text-slate-500 text-lg md:text-xl font-medium max-w-xl mx-auto leading-relaxed">
                    Saisissez le code officiel pour valider l'authenticité de votre document FSA.
                </p>
            </div>
        </motion.div>

        {/* Search */}
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative w-full max-w-3xl mx-auto group"
        >
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-[2.5rem] opacity-5 group-focus-within:opacity-20 blur-2xl transition duration-700" />
            
            <div className="relative bg-white/80 backdrop-blur-[60px] rounded-[3rem] border border-white p-3 md:p-4 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.06)]">
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    <div className="relative flex-1 group/input">
                        <div className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-emerald-500 transition-colors">
                            <Search className="w-6 h-6" />
                        </div>
                        <input
                            {...register("code")}
                            type="text"
                            placeholder="Ex: FSA-2026... ou A3F7C"
                            className="w-full h-16 md:h-24 pl-14 md:pl-20 pr-10 bg-transparent border-none rounded-3xl focus:ring-0 text-lg md:text-2xl font-black uppercase tracking-widest text-slate-900 placeholder:text-slate-300 placeholder:font-bold placeholder:normal-case transition-all placeholder:tracking-normal placeholder:text-[13px] md:placeholder:text-xl font-sans"
                            autoComplete="off"
                            disabled={loading}
                        />
                    </div>
                    
                    <Button 
                        disabled={loading}
                        className="h-16 md:h-20 px-10 md:px-14 rounded-[2rem] bg-slate-900 hover:bg-emerald-600 text-white font-black uppercase tracking-[0.25em] text-xs md:text-sm shadow-xl shadow-slate-200 transition-all duration-500 group/btn shrink-0"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                            <div className="flex items-center gap-4">
                                <span>Vérifier</span>
                                <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1.5 transition-transform" />
                            </div>
                        )}
                    </Button>
                </form>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-6">
              <div className="flex items-center gap-3 text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-[0.3em]">
                <Fingerprint className="w-5 h-5 text-emerald-500" />
                <span>Format Officiel</span>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 bg-slate-50/50 p-4 md:p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group/format">
                <span className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-emerald-700 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-sm">FSA</span>
                <span className="text-slate-300 font-bold">-</span>
                <span className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-sm">2026 - 04</span>
                <span className="text-slate-300 font-bold">-</span>
                <span className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-indigo-600 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-sm">00001</span>
                <span className="text-slate-300 font-bold">-</span>
                <span className="px-4 py-2 bg-slate-950 rounded-xl text-white text-[10px] md:text-xs font-black uppercase tracking-widest shadow-sm">A3F7C</span>
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-[9px] font-bold uppercase tracking-widest">
                <Info className="w-3 h-3 text-emerald-500" />
                <span>Indiquez le code complet ou seulement le hash (ex: A3F7C)</span>
              </div>
            </div>
        </motion.div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {result && (
              <motion.div 
                  initial={{ opacity: 0, y: 40, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6, ease: "circOut" }}
                  className="w-full space-y-12"
              >
                  <div className="relative bg-white border border-slate-100 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.06)] overflow-hidden">
                      <div className="p-8 md:p-14 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 border-b border-slate-50">
                          <div className={`w-28 h-28 md:w-36 md:h-36 rounded-[2.8rem] flex items-center justify-center shrink-0 border border-slate-50 shadow-2xl relative ${result.status === 'VALIDATED' ? 'text-emerald-500 bg-emerald-50/30' : 'text-rose-500 bg-rose-50/30'}`}>
                              <div className={`absolute -inset-2 rounded-[3.2rem] blur-xl opacity-20 ${result.status === 'VALIDATED' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {result.status === 'VALIDATED' ? <ShieldCheck className="w-16 h-16 relative" /> : <XCircle className="w-16 h-16 relative" />}
                          </div>

                          <div className="flex-1 text-center md:text-left space-y-4">
                              <Badge className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border-none ${result.status === 'VALIDATED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {result.status === 'VALIDATED' ? 'FSA Certifié' : 'Inconnu / Erreur'}
                              </Badge>
                              <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">
                                  {result.fullName}
                              </h2>
                              <p className="text-slate-500 font-bold text-lg md:text-xl">{result.formation?.name || "Certificat Officiel"}</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3">
                          <div className="p-10 border-b md:border-b-0 md:border-r border-slate-50">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Parcours</p>
                            <p className="text-xl font-black text-slate-800">{result.formation?.name || "Spécialisation"}</p>
                            <p className="text-sm font-bold text-slate-400 mt-1 capitalize">{result.formation?.category || "Bénéficiaire"}</p>
                          </div>
                          <div className="p-10 border-b md:border-b-0 md:border-r border-slate-50">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Période</p>
                            <p className="text-xl font-black text-slate-800">{formatDate(result.startDate)}</p>
                            <p className="text-sm font-bold text-slate-400 mt-1">au {formatDate(result.endDate)}</p>
                          </div>
                          <div className="p-10">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Evaluation</p>
                            <p className={`text-4xl font-black ${result.score >= 60 ? 'text-emerald-500' : 'text-slate-800'}`}>{result.score}/100</p>
                            <p className="text-sm font-bold text-slate-400 mt-1 capitalize">{result.status.toLowerCase()}</p>
                          </div>
                      </div>
                  </div>

                  {result.status === "VALIDATED" && (
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-8"
                    >
                      <div className="flex items-center justify-between px-6">
                        <div className="flex items-center gap-3">
                          <Sparkles className="w-5 h-5 text-emerald-500" />
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-600">Aperçu du Certificat</h3>
                        </div>
                        <Button variant="ghost" className="gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                          <Download className="w-4 h-4" /> Sauvegarder
                        </Button>
                      </div>

                      <div className="relative group perspective-1000">
                        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 transition-transform duration-700 group-hover:scale-[1.01] origin-top">
                          <div className="scale-[0.8] md:scale-[0.9] lg:scale-100 origin-top overflow-hidden">
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
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="bg-slate-50 rounded-[2.5rem] p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8 border border-slate-100">
                    <div className="flex gap-6 items-center">
                      <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center text-slate-300">
                        <AlertTriangle className="w-8 h-8" />
                      </div>
                      <div className="space-y-1 text-left">
                        <p className="font-black text-slate-900">Une erreur ?</p>
                        <p className="text-slate-500 text-sm font-medium">Contactez notre support pour une assistance rapide.</p>
                      </div>
                    </div>
                    <Link href="/contact">
                      <Button className="h-16 px-10 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white transition-all font-black uppercase tracking-widest text-xs">
                        Nous Contacter
                      </Button>
                    </Link>
                  </div>
              </motion.div>
          )}

          {error && (
              <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full bg-rose-50 border border-rose-100 rounded-[3rem] p-10 md:p-16 text-rose-600 flex flex-col md:flex-row items-center gap-10 shadow-2xl shadow-rose-900/5 relative overflow-hidden"
              >
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-[2.5rem] bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xl shadow-rose-600/40">
                      <XCircle className="w-12 h-12 md:w-16 md:h-16" />
                  </div>
                  <div className="space-y-4 text-center md:text-left flex-1">
                      <p className="text-[12px] font-black uppercase tracking-[0.3em] opacity-60">Erreur de Vérification</p>
                      <h3 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1]">{error}</h3>
                      <p className="text-lg font-medium opacity-80 max-w-lg leading-relaxed">Le code saisi ne correspond à aucune attestation active. Vérifiez le format (ex: A3F7C).</p>
                  </div>
              </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center space-y-8 pt-12 md:pt-20">
          <div className="h-px w-20 bg-slate-200 mx-auto" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">Système de Protection Interne FSA</p>
            <p className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.1em]">Données chiffrées & certifiées</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifierPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-emerald-600" /></div>}>
      <VerifierContent />
    </Suspense>
  );
}
