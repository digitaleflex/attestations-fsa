"use client";

import { useState, useEffect, Suspense, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  KeyRound,
  Mail,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  GraduationCap,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/error-translator";

const FsaCodeSchema = z.object({
  fsaCode: z
    .string()
    .min(
      5,
      "Le code FSA ou le hash final doit comporter au moins 5 caractères.",
    )
    .max(50, "Le code saisi est trop long."),
});

const OtpSchema = z.object({
  otp: z
    .string()
    .length(6, "Le code OTP doit comporter exactement 6 chiffres."),
});

const EmailSignInSchema = z.object({
  email: z.string().email("Veuillez entrer une adresse e-mail valide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

type LoginTab = "password" | "fsa";
type VerificationMode = "fsa" | "email";

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: "spring" as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    },
  },
  exit: (dir: number) => ({
    x: dir < 0 ? 50 : -50,
    opacity: 0,
    transition: {
      x: { type: "spring" as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    },
  }),
} as const;

// Messages lisibles pour les codes d'erreur renvoyés dans l'URL (?error=...)
const URL_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Votre adresse e-mail n'est pas encore vérifiée.",
  invalid_token: "Le lien de vérification est invalide ou a déjà été utilisé.",
  INVALID_TOKEN: "Le lien de vérification est invalide ou a déjà été utilisé.",
  expired_token: "Le lien de vérification a expiré. Veuillez réessayer.",
  EXPIRED_TOKEN: "Le lien de vérification a expiré. Veuillez réessayer.",
  invalid_email: "L'adresse e-mail fournie est invalide.",
  INVALID_EMAIL: "L'adresse e-mail fournie est invalide.",
  user_not_found: "Aucun compte n'est associé à cette adresse e-mail.",
  USER_NOT_FOUND: "Aucun compte n'est associé à cette adresse e-mail.",
};

function humanizeAuthError(raw: string): string {
  return URL_ERROR_MESSAGES[raw] ?? translateAuthError(raw);
}

function getSafeCallbackUrl(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const baseUrl = new URL("https://internal.invalid");
    const callbackUrl = new URL(value, baseUrl);
    if (callbackUrl.origin !== baseUrl.origin) return "/dashboard";

    return `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
  } catch {
    return "/dashboard";
  }
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = getSafeCallbackUrl(
    searchParams?.get("callbackUrl") ||
      searchParams?.get("callbackURL"),
  );

  // États de l'interface
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<number>(1); // 1 = suivant, -1 = précédent
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resendCooldown, setResendCooldown] = useState(0);

  // Onglet de connexion + mode de vérification
  const [tab, setTab] = useState<LoginTab>("password");
  const [verificationMode, setVerificationMode] =
    useState<VerificationMode>("fsa");

  // Valeurs du formulaire e-mail / mot de passe
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Valeurs du formulaire FSA / OTP
  const [fsaCode, setFsaCode] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  // Afficher une éventuelle erreur transmise dans l'URL
  useEffect(() => {
    const urlError = searchParams?.get("error");
    if (urlError) {
      setError(humanizeAuthError(urlError));
    }
  }, [searchParams]);

  // Pré-remplir le code FSA si passé dans l'URL
  useEffect(() => {
    const urlCode = searchParams?.get("code");
    if (urlCode) {
      setFsaCode(urlCode.trim());
      setTab("fsa");
    }
  }, [searchParams]);

  // Gérer le cooldown de l'OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const switchTab = (next: LoginTab) => {
    setTab(next);
    setError("");
    setFieldErrors({});
  };

  const handleFsaCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFsaCode(e.target.value);
    clearFieldError("fsaCode");
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    setOtp(val);
    clearFieldError("otp");
  };

  // ============ CONNEXION E-MAIL + MOT DE PASSE ============
  const handleEmailPasswordSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    const parse = EmailSignInSchema.safeParse({ email, password });
    if (!parse.success) {
      const errors: Record<string, string> = {};
      parse.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    const trimmedEmail = email.trim();

    try {
      const { error: authError } = await authClient.signIn.email({
        email: trimmedEmail,
        password,
        callbackURL: callbackUrl,
      });

      if (authError) {
        const code = (authError as { code?: string }).code;
        const rawMessage = authError.message || "";
        const notVerified =
          code === "EMAIL_NOT_VERIFIED" ||
          /not verified|non v[ée]rifi/i.test(rawMessage);

        if (notVerified) {
          // Compte existant dont l'e-mail n'est pas vérifié :
          // on bascule vers la vérification par code OTP.
          setMaskedEmail(trimmedEmail);
          setDirection(1);
          setVerificationMode("email");
          setStep(2);
          setOtp("");
          setError(
            "Votre adresse e-mail n'est pas encore vérifiée. Saisissez le code qui vient de vous être envoyé, ou cliquez sur « Renvoyer le code ».",
          );
          toast.info("Vérification de l'e-mail requise", {
            description: "Un nouveau code vient de vous être envoyé.",
          });
          // Envoi automatique d'un code frais (sans toast pour éviter le doublon visuel)
          void sendEmailVerificationOtp(trimmedEmail, false);
          return;
        }

        const message =
          translateAuthError(rawMessage) || "Échec de la connexion.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("Connexion réussie !");
      setIsRedirecting(true);
      router.push(callbackUrl);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? translateAuthError(err.message)
          : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ============ ÉTAPE 1 : DEMANDE DE L'OTP FSA ============
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
      setVerificationMode("fsa");
      setStep(2);
      setResendCooldown(60); // Initialiser le cooldown à 60s
      toast.success("🔑 Options de connexion envoyées par e-mail !");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de traiter la demande.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Renvoyer l'OTP FSA
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Impossible de renvoyer le code.";
      setError(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  // ============ VÉRIFICATION E-MAIL (OTP Better Auth) ============
  const sendEmailVerificationOtp = async (
    targetEmail: string,
    showToast: boolean,
  ) => {
    setResending(true);
    try {
      const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
        email: targetEmail,
        type: "email-verification",
      });

      if (otpError) throw otpError;

      setResendCooldown(60);
      if (showToast) toast.success("🔄 Nouveau code de vérification envoyé !");
      return true;
    } catch (err: unknown) {
      const message = translateAuthError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer le code de vérification.",
      );
      setError(message);
      if (showToast) toast.error(message);
      return false;
    } finally {
      setResending(false);
    }
  };

  const handleVerifyEmailOtp = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
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
      const { error: verifyError } = await authClient.emailOtp.verifyEmail({
        email: maskedEmail,
        otp,
      });

      if (verifyError) throw verifyError;

      // La vérification peut ne pas ouvrir de session : on se connecte
      // explicitement avec le mot de passe saisi pour garantir l'accès.
      const { error: signInError } = await authClient.signIn.email({
        email: maskedEmail,
        password,
        callbackURL: callbackUrl,
      });

      if (signInError) throw signInError;

      toast.success("E-mail vérifié ! Connexion en cours...");
      setIsRedirecting(true);
      router.push(callbackUrl);
    } catch (err: unknown) {
      const message = translateAuthError(
        err instanceof Error ? err.message : "Code invalide ou expiré.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ============ ÉTAPE 2 : VÉRIFICATION DE L'OTP FSA ============
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
      router.push(callbackUrl);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Code de vérification invalide.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const goBackToStepOne = () => {
    setDirection(-1);
    setStep(1);
    setOtp("");
    setVerificationMode("fsa");
    setError("");
    setFieldErrors({});
  };

  const headerTitle =
    step === 1
      ? "Connexion"
      : verificationMode === "email"
        ? "Vérifiez votre e-mail"
        : "Sécurité OTP";

  const headerDescription =
    step === 1
      ? tab === "password"
        ? "Connectez-vous avec votre adresse e-mail et votre mot de passe."
        : "Saisissez votre e-mail ou votre code d'attestation FSA pour recevoir un code de connexion."
      : verificationMode === "email"
        ? "Pour activer votre compte, saisissez le code de vérification à 6 chiffres envoyé à :"
        : "Pour votre sécurité, un code d'authentification à 6 chiffres a été envoyé à :";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden px-4 py-8">
      {/* Premium Backdrops */}
      <div className="absolute inset-0 z-0 bg-grid-slate-200/50 bg-[size:30px_30px] opacity-40 pointer-events-none" />
      <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] bg-brand/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] bg-brand-dark/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card box with glassmorphism and subtle ring */}
      <Card className="bg-white/80 backdrop-blur-3xl rounded-[3rem] shadow-[0_32px_64px_rgba(0,0,0,0.06)] w-full max-w-lg px-6 py-10 sm:px-12 sm:py-14 border border-white/90 relative overflow-hidden z-10 hover:shadow-[0_48px_80px_rgba(0,0,0,0.08)] transition-all duration-500">
        {/* Glow corner elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-dark/5 rounded-full blur-2xl pointer-events-none" />

        {/* Dynamic Animate Header & Icons */}
        <div className="flex flex-col items-center mb-8 relative z-10 text-center">
          <div className="relative w-20 h-20 bg-gradient-to-br from-brand to-brand-dark rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-brand/30 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-1000" />
            {step === 1 ? (
              tab === "password" ? (
                <Lock className="w-9 h-9 text-white" />
              ) : (
                <KeyRound className="w-9 h-9 text-white" />
              )
            ) : verificationMode === "email" ? (
              <Mail className="w-9 h-9 text-white" />
            ) : (
              <ShieldCheck className="w-9 h-9 text-white animate-pulse" />
            )}
          </div>

          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">
            {headerTitle}
          </h1>

          <p className="text-slate-400 text-sm mt-3 px-4 font-medium leading-relaxed">
            {headerDescription}
          </p>

          {step === 2 && (
            <span className="mt-3 font-bold text-brand-dark text-xs tracking-wider bg-brand/10 px-4 py-1.5 rounded-full border border-brand/20 shadow-sm">
              {maskedEmail}
            </span>
          )}
        </div>

        {error && (
          <Alert
            variant="destructive"
            className="mb-6 rounded-2xl border-red-100 bg-red-50/50 backdrop-blur-md"
          >
            <AlertTitle className="font-bold">Erreur</AlertTitle>
            <AlertDescription className="font-medium text-xs text-red-800/95 leading-relaxed">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="relative overflow-hidden min-h-[200px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {step === 1 ? (
              /* ================= ÉTAPE 1 : CONNEXION ================= */
              <motion.form
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                onSubmit={
                  tab === "password"
                    ? handleEmailPasswordSubmit
                    : handleRequestOtp
                }
                className="space-y-6 relative z-10"
              >
                {/* Sélecteur de méthode */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/80 rounded-2xl border border-slate-100">
                  {(
                    [
                      { id: "password", label: "Mot de passe", icon: Lock },
                      { id: "fsa", label: "Code FSA & OTP", icon: KeyRound },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => switchTab(id)}
                      className={`relative z-10 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors duration-300 ${
                        tab === id
                          ? "text-white"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {tab === id && (
                        <motion.span
                          layoutId="auth-tab-pill"
                          className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-brand to-brand-dark shadow-lg shadow-brand/20"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 32,
                          }}
                        />
                      )}
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {tab === "password" ? (
                  /* --- Connexion e-mail + mot de passe --- */
                  <>
                    <div className="space-y-2">
                      <Label
                        htmlFor="email"
                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                      >
                        Adresse e-mail
                      </Label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-brand transition-colors duration-300" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            clearFieldError("email");
                          }}
                          required
                          placeholder="votre@email.com"
                          className={`pl-12 h-14 rounded-2xl text-base font-bold tracking-wide border-slate-100 bg-slate-50/50 focus:border-brand/80 focus:bg-white focus:ring-4 focus:ring-brand/5 transition-all duration-300 shadow-inner ${
                            fieldErrors.email
                              ? "border-red-500 focus:ring-red-500/5"
                              : ""
                          }`}
                          autoComplete="email"
                          disabled={loading}
                        />
                      </div>
                      {fieldErrors.email && (
                        <p className="text-red-500 text-xs font-semibold mt-1 pl-2">
                          {fieldErrors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <Label
                          htmlFor="password"
                          className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                        >
                          Mot de passe
                        </Label>
                        <Link
                          href="/forgot-password"
                          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-brand transition-colors"
                        >
                          Mot de passe oublié ?
                        </Link>
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-brand transition-colors duration-300" />
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            clearFieldError("password");
                          }}
                          required
                          placeholder="••••••••"
                          className={`pl-12 pr-12 h-14 rounded-2xl text-base font-bold tracking-wide border-slate-100 bg-slate-50/50 focus:border-brand/80 focus:bg-white focus:ring-4 focus:ring-brand/5 transition-all duration-300 shadow-inner ${
                            fieldErrors.password
                              ? "border-red-500 focus:ring-red-500/5"
                              : ""
                          }`}
                          autoComplete="current-password"
                          disabled={loading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-4 top-4 rounded-md text-slate-300 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={
                            showPassword
                              ? "Masquer le mot de passe"
                              : "Afficher le mot de passe"
                          }
                          aria-pressed={showPassword}
                          disabled={loading}
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="text-red-500 text-xs font-semibold mt-1 pl-2">
                          {fieldErrors.password}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-14 text-sm font-black uppercase tracking-widest rounded-2xl bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark shadow-xl shadow-brand/10 hover:shadow-brand/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 group text-white border-none"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin w-5 h-5 mr-1 text-white" />
                          Connexion...
                        </>
                      ) : (
                        <>
                          Se connecter
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  /* --- Connexion par code FSA / OTP --- */
                  <>
                    <div className="space-y-2">
                      <Label
                        htmlFor="fsaCode"
                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                      >
                        E-mail ou Code FSA
                      </Label>
                      <div className="relative group">
                        <KeyRound className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-brand transition-colors duration-300" />
                        <Input
                          id="fsaCode"
                          name="fsaCode"
                          type="text"
                          value={fsaCode}
                          onChange={handleFsaCodeChange}
                          required
                          placeholder="Ex: candidat@email.com ou code FSA"
                          className={`pl-12 h-14 rounded-2xl text-base font-bold tracking-wide border-slate-100 bg-slate-50/50 focus:border-brand/80 focus:bg-white focus:ring-4 focus:ring-brand/5 transition-all duration-300 shadow-inner ${
                            fieldErrors.fsaCode
                              ? "border-red-500 focus:ring-red-500/5"
                              : ""
                          }`}
                          autoComplete="off"
                          disabled={loading}
                        />
                      </div>
                      {fieldErrors.fsaCode && (
                        <p className="text-red-500 text-xs font-semibold mt-1 pl-2">
                          {fieldErrors.fsaCode}
                        </p>
                      )}

                      <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100 flex items-start gap-3 mt-3">
                        <GraduationCap className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          Saisissez votre e-mail (si pré-enregistré par
                          l&apos;administration) ou le code FSA figurant sur
                          votre relevé ou attestation. Pour aller plus vite,
                          vous pouvez aussi saisir uniquement les 5 derniers
                          caractères du code FSA (ex:{" "}
                          <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold font-mono text-brand-dark">
                            f0f9a
                          </code>
                          ).
                        </p>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-14 text-sm font-black uppercase tracking-widest rounded-2xl bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark shadow-xl shadow-brand/10 hover:shadow-brand/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 group text-white border-none"
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
                  </>
                )}
              </motion.form>
            ) : verificationMode === "email" ? (
              /* ================= ÉTAPE 2 : VÉRIFICATION E-MAIL ================= */
              <motion.div
                key="email-verify"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6 relative z-10"
              >
                <form onSubmit={handleVerifyEmailOtp} className="space-y-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email-otp"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                    >
                      Code de vérification (6 chiffres)
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-brand transition-colors duration-300" />
                      <Input
                        id="email-otp"
                        name="email-otp"
                        type="text"
                        inputMode="numeric"
                        value={otp}
                        onChange={handleOtpChange}
                        required
                        placeholder="0 0 0 0 0 0"
                        className={`pl-12 h-14 rounded-2xl text-center text-xl font-black tracking-[0.25em] border-slate-100 bg-slate-50/50 focus:border-brand/80 focus:bg-white focus:ring-4 focus:ring-brand/5 transition-all duration-300 shadow-inner ${
                          fieldErrors.otp
                            ? "border-red-500 focus:ring-red-500/5"
                            : ""
                        }`}
                        autoComplete="one-time-code"
                        disabled={loading}
                      />
                    </div>
                    {fieldErrors.otp && (
                      <p className="text-red-500 text-xs font-semibold mt-1 text-center">
                        {fieldErrors.otp}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goBackToStepOne}
                      className="flex-1 h-14 font-black uppercase tracking-widest text-xs rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center gap-2"
                      disabled={loading || resending}
                    >
                      <ArrowLeft className="w-4 h-4 text-slate-400" />
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      className="flex-[2] h-14 text-sm font-black uppercase tracking-widest rounded-2xl bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark shadow-xl shadow-brand/10 hover:shadow-brand/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 text-white border-none"
                      disabled={loading || resending}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin w-5 h-5 mr-1 text-white" />
                          Vérification...
                        </>
                      ) : (
                        "Vérifier le code"
                      )}
                    </Button>
                  </div>

                  <div className="flex flex-col items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => sendEmailVerificationOtp(maskedEmail, true)}
                      className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors focus:outline-none ${
                        resendCooldown > 0
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-brand"
                      }`}
                      disabled={loading || resending || resendCooldown > 0}
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${resending ? "animate-spin text-brand" : ""}`}
                      />
                      {resending
                        ? "Renvoi en cours..."
                        : resendCooldown > 0
                          ? `Renvoyer le code (dans ${resendCooldown}s)`
                          : "Renvoyer le code"}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              /* ================= ÉTAPE 2 : OTP FSA ================= */
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6 relative z-10"
              >
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="otp"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                    >
                      Code OTP (6 chiffres)
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-brand transition-colors duration-300" />
                      <Input
                        id="otp"
                        name="otp"
                        type="text"
                        inputMode="numeric"
                        value={otp}
                        onChange={handleOtpChange}
                        required
                        placeholder="0 0 0 0 0 0"
                        className={`pl-12 h-14 rounded-2xl text-center text-xl font-black tracking-[0.25em] border-slate-100 bg-slate-50/50 focus:border-brand/80 focus:bg-white focus:ring-4 focus:ring-brand/5 transition-all duration-300 shadow-inner ${
                          fieldErrors.otp
                            ? "border-red-500 focus:ring-red-500/5"
                            : ""
                        }`}
                        autoComplete="one-time-code"
                        disabled={loading}
                      />
                    </div>
                    {fieldErrors.otp && (
                      <p className="text-red-500 text-xs font-semibold mt-1 text-center">
                        {fieldErrors.otp}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goBackToStepOne}
                      className="flex-1 h-14 font-black uppercase tracking-widest text-xs rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center gap-2"
                      disabled={loading || resending}
                    >
                      <ArrowLeft className="w-4 h-4 text-slate-400" />
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      className="flex-[2] h-14 text-sm font-black uppercase tracking-widest rounded-2xl bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark shadow-xl shadow-brand/10 hover:shadow-brand/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 text-white border-none"
                      disabled={loading || resending}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin w-5 h-5 mr-1 text-white" />
                          Connexion...
                        </>
                      ) : (
                        <>Se connecter</>
                      )}
                    </Button>
                  </div>

                  <div className="flex flex-col items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors focus:outline-none ${
                        resendCooldown > 0
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-brand"
                      }`}
                      disabled={loading || resending || resendCooldown > 0}
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${resending ? "animate-spin text-brand" : ""}`}
                      />
                      {resending
                        ? "Renvoi en cours..."
                        : resendCooldown > 0
                          ? `Renvoyer le code (dans ${resendCooldown}s)`
                          : "Renvoyer le code OTP"}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Créer un compte + retour au portail */}
        <div className="mt-8 pt-6 border-t border-slate-100/80 flex flex-col items-center gap-3">
          <Link
            href="/inscription"
            className="text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-dark transition-colors flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Pas de compte ? Créer un compte
          </Link>
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-brand transition-colors flex items-center gap-1.5"
          >
            <span>←</span> Retour au portail
          </Link>
        </div>
      </Card>

      {/* Modern Vortex Portal overlay */}
      {isRedirecting && (
        <div
          className="vortex-overlay"
          style={
            {
              "--vortex-color-1": "#10b981",
              "--vortex-color-2": "#2563eb",
            } as CSSProperties
          }
        >
          <div className="vortex-halo">
            <div className="vortex-ring" />
            <div className="vortex-ring-inner" />
            <div className="vortex-core">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
          </div>
          <p className="text-brand-dark font-black uppercase tracking-widest text-sm animate-pulse mt-8">
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
          animation: spin-reverse 1.5s cubic-bezier(0.53, 0.21, 0.29, 0.67)
            infinite;
        }

        .vortex-core {
          width: 60px;
          height: 60px;
          border-radius: 20px;
          background: linear-gradient(
            135deg,
            var(--vortex-color-1),
            var(--vortex-color-2)
          );
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes spin-reverse {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative">
          <div className="absolute inset-0 bg-grid-slate-200/50 bg-[size:30px_30px] opacity-40 pointer-events-none" />
          <Loader2 className="animate-spin w-8 h-8 text-brand relative z-10" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
