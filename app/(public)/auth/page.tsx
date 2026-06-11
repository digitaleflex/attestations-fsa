"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, Mail, ArrowRight, ShieldCheck, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";

const FsaCodeSchema = z.object({
  fsaCode: z.string()
    .min(5, "Le code FSA ou le hash final doit comporter au moins 5 caractères.")
    .max(50, "Le code saisi est trop long.")
});

const OtpSchema = z.object({
  otp: z.string().length(6, "Le code OTP doit comporter exactement 6 chiffres.")
});

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // États de l'interface
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Valeurs du formulaire
  const [fsaCode, setFsaCode] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  // Pré-remplir le code FSA si passé dans l'URL
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setFsaCode(urlCode.trim());
    }
  }, [searchParams]);

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
    // Garder uniquement les chiffres
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
      setStep(2);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 p-3 sm:p-4 w-full">
      <Card className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg px-6 py-10 sm:px-12 sm:py-14 border border-gray-100/80 animate-in zoom-in-95 duration-500 relative overflow-hidden">
        {/* Effet décoratif discret */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
            {step === 1 ? (
              <KeyRound className="w-8 h-8 text-white" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-white animate-pulse" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            {step === 1 ? "Accéder à mon Espace" : "Vérification de sécurité"}
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 text-center px-4">
            {step === 1 
              ? "Saisissez votre code FSA ou votre identifiant de fin pour composer ou voir vos résultats."
              : `Un code de validation temporaire a été envoyé à l'adresse e-mail :`
            }
          </p>
          {step === 2 && (
            <span className="mt-1 font-bold text-emerald-600 text-sm tracking-wide bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              {maskedEmail}
            </span>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 rounded-2xl">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 ? (
          /* ================= ÉTAPE 1 : CODE FSA ================= */
          <form onSubmit={handleRequestOtp} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <Label htmlFor="fsaCode" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Code FSA ou Identifiant
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                <Input
                  id="fsaCode"
                  name="fsaCode"
                  type="text"
                  value={fsaCode}
                  onChange={handleFsaCodeChange}
                  required
                  placeholder="Ex: FSA-2026-M06-00003-f0f9a ou f0f9a"
                  className={`pl-11 h-12 rounded-xl text-base font-semibold tracking-wide border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/5 ${
                    fieldErrors.fsaCode ? "border-red-500 focus:ring-red-500/5" : ""
                  }`}
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
              {fieldErrors.fsaCode && (
                <p className="text-red-500 text-xs font-semibold mt-1 pl-2">{fieldErrors.fsaCode}</p>
              )}
              <p className="text-[11px] text-slate-400 font-medium pl-1">
                💡 Vous pouvez saisir le code complet ou simplement le hash de 5 caractères situé à la fin de votre attestation.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/15 transition-all flex items-center justify-center gap-2 group"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5" />
                  Validation en cours...
                </>
              ) : (
                <>
                  Continuer
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        ) : (
          /* ================= ÉTAPE 2 : CODE OTP ================= */
          <form onSubmit={handleVerifyOtp} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Code de validation (6 chiffres)
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                <Input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={handleOtpChange}
                  required
                  placeholder="000000"
                  className={`pl-11 h-12 rounded-xl text-center text-xl font-bold tracking-[0.4em] border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/5 ${
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
                  setStep(1);
                  setOtp("");
                  setError("");
                }}
                className="flex-1 h-12 font-bold rounded-xl border-slate-200 text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50"
                disabled={loading || resending}
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Button>
              <Button
                type="submit"
                className="flex-[2] h-12 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/15 transition-all flex items-center justify-center gap-2"
                disabled={loading || resending}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5" />
                    Validation...
                  </>
                ) : (
                  <>
                    Se connecter
                  </>
                )}
              </Button>
            </div>

            {/* Renvoyer OTP */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleResendOtp}
                className="text-slate-400 hover:text-emerald-600 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors focus:outline-none"
                disabled={loading || resending}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin text-emerald-600" : ""}`} />
                {resending ? "Renvoi du code..." : "Renvoyer le code"}
              </button>
            </div>
          </form>
        )}

        {/* Bouton retour accueil */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
          <Link href="/" className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </Card>

      {/* Vortex Redirection Overlay */}
      {isRedirecting && (
        <div className="vortex-overlay" style={{ "--vortex-color-1": "#10b981", "--vortex-color-2": "#2563eb" } as any}>
          <div className="vortex-halo">
            <div className="vortex-ring" />
            <div className="vortex-ring-inner" />
            <div className="vortex-core">
              <span className="text-2xl">🎓</span>
            </div>
          </div>
          <p className="text-emerald-900 font-bold text-xl animate-pulse">Accès en cours...</p>
        </div>
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50">Chargement...</div>}>
      <AuthContent />
    </Suspense>
  );
}
