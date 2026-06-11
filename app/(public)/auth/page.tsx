"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, Mail, ArrowRight, ShieldCheck, RefreshCw, ArrowLeft, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

const FsaCodeSchema = z.object({
  fsaCode: z.string()
    .min(5, "Le code FSA ou le hash final doit comporter au moins 5 caractères.")
    .max(50, "Le code saisi est trop long.")
});

const OtpSchema = z.object({
  otp: z.string().length(6, "Le code OTP doit comporter exactement 6 chiffres.")
});

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: "spring" as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 }
    }
  },
  exit: (dir: number) => ({
    x: dir < 0 ? 50 : -50,
    opacity: 0,
    transition: {
      x: { type: "spring" as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 }
    }
  })
} as const;

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // États de l'interface
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<number>(1); // 1 = suivant, -1 = précédent
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Valeurs du formulaire
  const [fsaCode, setFsaCode] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  // Pré-remplir le code FSA si passé dans l'URL
  useEffect(() => {
    const urlCode = searchParams?.get("code");
    if (urlCode) {
      setFsaCode(urlCode.trim());
    }
  }, [searchParams]);

  // Gérer le cooldown de l'OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleFsaCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFsaCode(e.target.value);
    if (fieldErrors.fsaCode) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.fsaCode;
        return next;
      });
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    setOtp(val);
    if (fieldErrors.otp) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.otp;
        return next;
      });
    }
  };

  // Étape 1 : Demande de l'OTP
  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    const parse = FsaCodeSchema.safeParse({ fsaCode });
    if (!parse.success) {
      const errors: Record<string, string> = {};
      parse.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/fsa-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request-otp",
          fsaCode: fsaCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Une erreur est survenue.");
      }

      setMaskedEmail(data.emailMasked);
      setDirection(1);
      setStep(2);
      setResendCooldown(60); // Initialiser le cooldown à 60s
      toast.success("🔑 Code de vérification envoyé par e-mail !");
    } catch (err: any) {
      const message = err.message || "Impossible de traiter la demande.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Renvoyer l'OTP
  const handleResendOtp = async () => {
    setResending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/fsa-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request-otp",
          fsaCode: fsaCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Une erreur est survenue.");
      }

      setResendCooldown(60); // Réinitialiser le cooldown à 60s après renvoi réussi
      toast.success("🔄 Nouveau code de vérification envoyé !");
    } catch (err: any) {
      const message = err.message || "Impossible de renvoyer le code.";
      setError(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  // Étape 2 : Vérification de l'OTP
  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    const parse = OtpSchema.safeParse({ otp });
    if (!parse.success) {
      const errors: Record<string, string> = {};
      parse.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/fsa-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-otp",
          fsaCode: fsaCode.trim(),
          otp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Code de vérification invalide.");
      }

      toast.success("Connexion réussie !");
      setIsRedirecting(true);
      router.push("/dashboard");
    } catch (err: any) {
      const message = err.message || "Code invalide.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden px-4 py-8">
      {/* Premium Backdrops */}
      <div className="absolute inset-0 z-0 bg-grid-slate-200/50 bg-[size:30px_30px] opacity-40 pointer-events-none" />
      <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card box with glassmorphism and subtle ring */}
      <Card className="bg-white/80 backdrop-blur-3xl rounded-[3rem] shadow-[0_32px_64px_rgba(0,0,0,0.06)] w-full max-w-lg px-6 py-10 sm:px-12 sm:py-14 border border-white/90 relative overflow-hidden z-10 hover:shadow-[0_48px_80px_rgba(0,0,0,0.08)] transition-all duration-500">
        
        {/* Glow corner elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/5 rounded-full blur-2xl pointer-events-none" />

        {/* Dynamic Animate Header & Icons */}
        <div className="flex flex-col items-center mb-8 relative z-10 text-center">
          <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-200/50 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-1000" />
            {step === 1 ? (
              <KeyRound className="w-9 h-9 text-white" />
            ) : (
              <ShieldCheck className="w-9 h-9 text-white animate-pulse" />
            )}
          </div>
          
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">
            {step === 1 ? "Espace Candidat" : "Sécurité OTP"}
          </h1>
          
          <p className="text-slate-400 text-sm mt-3 px-4 font-medium leading-relaxed">
            {step === 1 
              ? "Saisissez votre code d'attestation FSA ou sa clé de fin à 5 caractères pour accéder à votre espace."
              : `Pour votre sécurité, un code d'authentification à 6 chiffres a été envoyé à :`
            }
          </p>
          
          {step === 2 && (
            <span className="mt-3 font-bold text-emerald-700 text-xs tracking-wider bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100/50 shadow-sm">
              {maskedEmail}
            </span>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 rounded-2xl border-red-100 bg-red-50/50 backdrop-blur-md">
            <AlertTitle className="font-bold">Erreur</AlertTitle>
            <AlertDescription className="font-medium text-xs text-red-800/95 leading-relaxed">{error}</AlertDescription>
          </Alert>
        )}

        <div className="relative overflow-hidden min-h-[200px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {step === 1 ? (
              /* ================= ÉTAPE 1 : CODE FSA ================= */
              <motion.form
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                onSubmit={handleRequestOtp}
                className="space-y-6 relative z-10"
              >
                <div className="space-y-2">
                  <Label htmlFor="fsaCode" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Code FSA ou clé finale (5 cars)
                  </Label>
                  <div className="relative group">
                    <KeyRound className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors duration-300" />
                    <Input
                      id="fsaCode"
                      name="fsaCode"
                      type="text"
                      value={fsaCode}
                      onChange={handleFsaCodeChange}
                      required
                      placeholder="Ex: FSA-2026-M06-00003-f0f9a ou f0f9a"
                      className={`pl-12 h-14 rounded-2xl text-base font-bold tracking-wide border-slate-100 bg-slate-50/50 focus:border-emerald-500/80 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all duration-300 shadow-inner ${
                        fieldErrors.fsaCode ? "border-red-500 focus:ring-red-500/5" : ""
                      }`}
                      autoComplete="off"
                      disabled={loading}
                    />
                  </div>
                  {fieldErrors.fsaCode && (
                    <p className="text-red-500 text-xs font-semibold mt-1 pl-2">{fieldErrors.fsaCode}</p>
                  )}
                  
                  <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100 flex items-start gap-3 mt-3">
                     <GraduationCap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                     <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        Le code FSA figure sur votre relevé ou attestation. Pour aller plus vite, saisissez uniquement les 5 derniers caractères (ex: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold font-mono text-emerald-700">f0f9a</code>).
                     </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 text-sm font-black uppercase tracking-widest rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl shadow-emerald-600/10 hover:shadow-emerald-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 group text-white border-none"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5 mr-1 text-white" />
                      Recherche du dossier...
                    </>
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                    </>
                  )}
                </Button>
              </motion.form>
            ) : (
              /* ================= ÉTAPE 2 : CODE OTP ================= */
              <motion.form
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                onSubmit={handleVerifyOtp}
                className="space-y-6 relative z-10"
              >
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Code OTP (6 chiffres)
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors duration-300" />
                    <Input
                      id="otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={handleOtpChange}
                      required
                      placeholder="0 0 0 0 0 0"
                      className={`pl-12 h-14 rounded-2xl text-center text-xl font-black tracking-[0.25em] border-slate-100 bg-slate-50/50 focus:border-emerald-500/80 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all duration-300 shadow-inner ${
                        fieldErrors.otp ? "border-red-500 focus:ring-red-500/5" : ""
                      }`}
                      autoComplete="one-time-code"
                      disabled={loading}
                    />
                  </div>
                  {fieldErrors.otp && (
                    <p className="text-red-500 text-xs font-semibold mt-1 text-center">{fieldErrors.otp}</p>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDirection(-1);
                      setStep(1);
                      setOtp("");
                      setError("");
                    }}
                    className="flex-1 h-14 font-black uppercase tracking-widest text-xs rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center gap-2"
                    disabled={loading || resending}
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-400" />
                    Retour
                  </Button>
                  <Button
                    type="submit"
                    className="flex-[2] h-14 text-sm font-black uppercase tracking-widest rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl shadow-emerald-600/10 hover:shadow-emerald-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 text-white border-none"
                    disabled={loading || resending}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin w-5 h-5 mr-1 text-white" />
                        Connexion...
                      </>
                    ) : (
                      <>
                        Se connecter
                      </>
                    )}
                  </Button>
                </div>

                {/* Resend OTP UI component */}
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors focus:outline-none ${
                      resendCooldown > 0 
                        ? "text-slate-300 cursor-not-allowed" 
                        : "text-slate-400 hover:text-emerald-600"
                    }`}
                    disabled={loading || resending || resendCooldown > 0}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin text-emerald-600" : ""}`} />
                    {resending 
                      ? "Renvoi en cours..." 
                      : resendCooldown > 0 
                        ? `Renvoyer le code (dans ${resendCooldown}s)` 
                        : "Renvoyer le code OTP"
                    }
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Back Link to Homepage */}
        <div className="mt-8 pt-6 border-t border-slate-100/80 flex justify-center">
          <Link href="/" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-emerald-600 transition-colors flex items-center gap-1.5">
            <span>←</span> Retour au portail
          </Link>
        </div>
      </Card>

      {/* Modern Vortex Portal overlay */}
      {isRedirecting && (
        <div className="vortex-overlay" style={{ "--vortex-color-1": "#10b981", "--vortex-color-2": "#2563eb" } as any}>
          <div className="vortex-halo">
            <div className="vortex-ring" />
            <div className="vortex-ring-inner" />
            <div className="vortex-core">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
          </div>
          <p className="text-emerald-900 font-black uppercase tracking-widest text-sm animate-pulse mt-8">
            Ouverture de votre Espace...
          </p>
        </div>
      )}

      {/* Specific Vortex CSS classes */}
      <style jsx global>{`
        .vortex-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(24px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .vortex-halo {
          position: relative;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .vortex-ring {
          position: absolute;
          inset: -10px;
          border: 3px solid transparent;
          border-top-color: var(--vortex-color-1);
          border-bottom-color: var(--vortex-color-1);
          border-radius: 50%;
          animation: spin 2s linear infinite;
        }

        .vortex-ring-inner {
          position: absolute;
          inset: 5px;
          border: 3px solid transparent;
          border-left-color: var(--vortex-color-2);
          border-right-color: var(--vortex-color-2);
          border-radius: 50%;
          animation: spin-reverse 1.5s cubic-bezier(0.53, 0.21, 0.29, 0.67) infinite;
        }

        .vortex-core {
          width: 60px;
          height: 60px;
          border-radius: 20px;
          background: linear-gradient(135deg, var(--vortex-color-1), var(--vortex-color-2));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes spin-reverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative">
        <div className="absolute inset-0 bg-grid-slate-200/50 bg-[size:30px_30px] opacity-40 pointer-events-none" />
        <Loader2 className="animate-spin w-8 h-8 text-emerald-600 relative z-10" />
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
