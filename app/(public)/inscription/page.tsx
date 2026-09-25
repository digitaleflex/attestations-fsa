"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import {
  div as MotionDiv,
  form as MotionForm,
  span as MotionSpan,
} from "framer-motion/client";
import { AnimatePresence } from "@/lib/framer-motion-client";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  Loader2,
  Lock,
  LogIn,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/error-translator";

/* -------------------------------------------------------------------------- */
/*                              Validation Zod                                */
/* -------------------------------------------------------------------------- */

const SignUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Le nom complet doit comporter au moins 2 caractères."),
    email: z
      .string()
      .trim()
      .email("Veuillez entrer une adresse e-mail valide."),
    password: z
      .string()
      .min(8, "Le mot de passe doit comporter au moins 8 caractères."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

const OtpSchema = z.object({
  otp: z
    .string()
    .length(6, "Le code doit comporter exactement 6 chiffres.")
    .regex(/^\d{6}$/, "Le code ne doit contenir que des chiffres."),
});

/* -------------------------------------------------------------------------- */
/*                                  Constantes                                */
/* -------------------------------------------------------------------------- */

const SUCCESS_REDIRECT = "/dashboard";
const RESEND_COOLDOWN_SECONDS = 30;

const BENEFITS = [
  {
    icon: GraduationCap,
    title: "Formations certifiantes",
    description:
      "Suivez vos parcours et retrouvez vos attestations au même endroit.",
  },
  {
    icon: ShieldCheck,
    title: "Suivi sécurisé",
    description:
      "Vos informations et vos résultats restent protégés et confidentiels.",
  },
  {
    icon: Mail,
    title: "Vérification par e-mail",
    description: "Activez votre compte avec un code à 6 chiffres en quelques secondes.",
  },
] as const;

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

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function fieldInputClass(hasError: boolean, extra = ""): string {
  return `h-14 rounded-2xl border bg-slate-50/50 text-base font-bold tracking-wide shadow-inner transition-all duration-300 focus:bg-white focus:ring-4 focus-visible:outline-none ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-500/5"
      : "border-slate-100 focus:border-brand/80 focus:ring-brand/5"
  } ${extra}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 pl-2 text-xs font-semibold text-red-500"
    >
      {message}
    </p>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div
      className="mb-8 flex items-center gap-3"
      aria-label="Progression de l'inscription"
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black transition-colors duration-300 ${
            step >= 1
              ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-md shadow-brand/20"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          {step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
        </span>
        <span
          className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${
            step >= 1 ? "text-slate-700" : "text-slate-300"
          }`}
        >
          Compte
        </span>
      </div>

      <div className="relative h-px flex-1 overflow-hidden bg-slate-100">
        <MotionSpan
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand to-brand-dark"
          initial={false}
          animate={{ width: step >= 2 ? "100%" : "0%" }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black transition-colors duration-300 ${
            step >= 2
              ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-md shadow-brand/20"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          2
        </span>
        <span
          className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${
            step >= 2 ? "text-slate-700" : "text-slate-300"
          }`}
        >
          Vérification
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function InscriptionPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resendCooldown, setResendCooldown] = useState(0);

  // Étape 1
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Étape 2
  const [otp, setOtp] = useState("");

  // Titre de l'onglet
  useEffect(() => {
    document.title = "Inscription — Créer un compte | Ferme St André";
  }, []);

  // Cooldown du renvoi de code
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
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

  const handleOtpChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(value);
    clearFieldError("otp");
  };

  /**
   * Traduit l'erreur technique en français et décide où l'afficher.
   * Retourne un message + un éventuel champ de formulaire concerné.
   */
  const resolveAuthError = (
    raw: string,
    context: "signup" | "otp",
  ): { message: string; field?: string } => {
    const msg = raw.toLowerCase();
    const base = translateAuthError(raw);

    if (context === "signup") {
      if (msg.includes("already") || msg.includes("exist")) {
        return {
          message: "Un compte existe déjà avec cette adresse e-mail.",
          field: "email",
        };
      }
      if (
        msg.includes("password") &&
        (msg.includes("short") || msg.includes("least") || msg.includes("min"))
      ) {
        return {
          message: "Le mot de passe doit comporter au moins 8 caractères.",
          field: "password",
        };
      }
      if (msg.includes("invalid email") || msg.includes("email is invalid")) {
        return {
          message: "Veuillez entrer une adresse e-mail valide.",
          field: "email",
        };
      }
    }

    if (context === "otp") {
      if (
        msg.includes("invalid") ||
        msg.includes("incorrect") ||
        msg.includes("expired") ||
        msg.includes("otp")
      ) {
        return {
          message:
            "Le code saisi est invalide ou a expiré. Demandez un nouveau code.",
          field: "otp",
        };
      }
    }

    return { message: base };
  };

  /* ------------------------------------------------------------------ */
  /*                        Étape 1 — Créer le compte                   */
  /* ------------------------------------------------------------------ */

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setFieldErrors({});

    const parsed = SignUpSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) errors[String(err.path[0])] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    const cleanName = parsed.data.name;
    const cleanEmail = parsed.data.email;
    const cleanPassword = parsed.data.password;

    setLoading(true);

    try {
      const { error: signUpError } = await authClient.signUp.email({
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
      });

      if (signUpError) {
        const { message, field } = resolveAuthError(
          signUpError.message || "",
          "signup",
        );
        if (field) {
          setFieldErrors({ [field]: message });
        } else {
          setError(message);
        }
        toast.error(message);
        return;
      }

      // Le compte est créé : on conserve les identifiants pour l'étape 2.
      setEmail(cleanEmail);
      setPassword(cleanPassword);
      setOtp("");
      setDirection(1);
      setStep(2);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success("Compte créé ! Vérifiez votre boîte e-mail.");
    } catch (err: unknown) {
      const message = translateAuthError(
        err instanceof Error ? err.message : "Impossible de créer le compte.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*                     Étape 2 — Vérifier l'e-mail (OTP)              */
  /* ------------------------------------------------------------------ */

  const handleResendOtp = async () => {
    if (resending || resendCooldown > 0 || loading) return;

    setResending(true);
    setError("");

    try {
      const { error: otpError } =
        await authClient.emailOtp.sendVerificationOtp({
          email,
          type: "email-verification",
        });

      if (otpError) throw otpError;

      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success("Un nouveau code vient de vous être envoyé.");
    } catch (err: unknown) {
      const message = translateAuthError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer le code de vérification.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setFieldErrors({});

    const parsed = OtpSchema.safeParse({ otp });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) errors[String(err.path[0])] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const { error: verifyError } = await authClient.emailOtp.verifyEmail({
        email,
        otp: parsed.data.otp,
      });

      if (verifyError) {
        const { message } = resolveAuthError(
          verifyError.message || "",
          "otp",
        );
        setFieldErrors({ otp: message });
        toast.error(message);
        return;
      }

      // La vérification peut ne pas ouvrir de session : on se connecte
      // explicitement avec le mot de passe conservé en mémoire.
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: SUCCESS_REDIRECT,
      });

      if (signInError) throw signInError;

      toast.success("E-mail vérifié ! Connexion en cours...");
      setIsRedirecting(true);
      router.push(SUCCESS_REDIRECT);
    } catch (err: unknown) {
      const message = translateAuthError(
        err instanceof Error
          ? err.message
          : "Code invalide ou expiré. Veuillez réessayer.",
      );
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
    setError("");
    setFieldErrors({});
  };

  /* ------------------------------------------------------------------ */
  /*                                Rendu                               */
  /* ------------------------------------------------------------------ */

  return (
    <div className="relative flex min-h-[calc(100vh-5rem)] w-full items-center justify-center overflow-hidden bg-[#fafbfc] px-4 py-10 sm:py-16">
      {/* Blobs flous d'arrière-plan */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none overflow-hidden"
      >
        <div className="absolute -left-[8%] -top-[12%] h-[46vw] w-[46vw] min-h-[320px] min-w-[320px] rounded-full bg-brand/20 blur-[120px]" />
        <div className="absolute -bottom-[14%] -right-[8%] h-[48vw] w-[48vw] min-h-[320px] min-w-[320px] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[34vw] w-[34vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-accent/10 blur-[100px]" />
      </div>

      {/* Trame discrète */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grid-slate-200/50 bg-[size:30px_30px] opacity-40"
      />

      <Card className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-white bg-white/70 shadow-[0_32px_64px_rgba(0,0,0,0.06)] backdrop-blur-3xl transition-shadow duration-500 hover:shadow-[0_48px_80px_rgba(0,0,0,0.08)] sm:rounded-[3rem]">
        <div className="grid lg:grid-cols-[1.05fr_1fr]">
          {/* ----------------------- Panneau de marque ----------------------- */}
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand via-brand-dark to-brand-dark p-10 text-white lg:flex xl:p-12">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-blue-900/20 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
            </div>

            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">
                    Ferme St André
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                    Espace candidat
                  </p>
                </div>
              </div>

              <h2 className="mt-12 text-3xl font-black leading-tight tracking-tight xl:text-4xl">
                Rejoignez la communauté FSA
              </h2>
              <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-white/80">
                Créez votre compte pour suivre vos formations, composer vos
                examens et télécharger vos attestations en toute sécurité.
              </p>

              <ul className="mt-10 space-y-5">
                {BENEFITS.map(({ icon: Icon, title, description }) => (
                  <li key={title} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
                      <Icon className="h-4 w-4 text-white" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-white">
                        {title}
                      </span>
                      <span className="block text-xs font-medium leading-relaxed text-white/70">
                        {description}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="relative mt-12 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
              L&apos;excellence agricole au Bénin
            </p>
          </aside>

          {/* ------------------------- Panneau formulaire ------------------------ */}
          <section className="relative px-6 py-10 sm:px-10 sm:py-12 xl:px-12">
            <StepIndicator step={step} />

            <div className="mb-7 flex flex-col items-center text-center">
              <div className="group relative mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark shadow-xl shadow-brand/30">
                <div className="absolute inset-0 translate-y-[-100%] bg-gradient-to-tr from-transparent via-white/15 to-transparent transition-transform duration-1000 group-hover:translate-y-[100%]" />
                {step === 1 ? (
                  <UserPlus className="h-8 w-8 text-white" />
                ) : (
                  <Mail className="h-8 w-8 text-white" />
                )}
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand">
                Inscription
              </span>
              <h1 className="mt-2 text-2xl font-black leading-none tracking-tight text-slate-800 sm:text-3xl">
                {step === 1 ? "Créer un compte" : "Vérifiez votre e-mail"}
              </h1>

              {step === 1 ? (
                <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-slate-400">
                  Remplissez le formulaire pour créer votre espace candidat.
                </p>
              ) : (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <p className="max-w-sm text-sm font-medium leading-relaxed text-slate-400">
                    Un code à 6 chiffres a été envoyé à
                  </p>
                  <span className="rounded-full border border-brand/20/60 bg-brand/10 px-4 py-1.5 text-xs font-bold tracking-wider text-brand-dark shadow-sm">
                    {email}
                  </span>
                  <p className="mt-1 flex max-w-xs items-start justify-center gap-2 text-[11px] font-medium leading-relaxed text-slate-500">
                    <Info
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <span>
                      Vous ne voyez pas le code ? Pensez à vérifier vos spams /
                      courriers indésirables.
                    </span>
                  </p>
                </div>
              )}
            </div>

            {error && (
              <Alert
                variant="destructive"
                className="mb-6 rounded-2xl border-red-100 bg-red-50/50 backdrop-blur-md"
              >
                <AlertTitle className="font-bold">Erreur</AlertTitle>
                <AlertDescription className="text-xs font-medium leading-relaxed text-red-800/95">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="relative min-h-[200px] overflow-hidden">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                {step === 1 ? (
                  /* ================= ÉTAPE 1 : CRÉATION DU COMPTE ================= */
                  <MotionForm
                    key="step1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    onSubmit={handleSignUp}
                    noValidate
                    className="relative z-10 space-y-5"
                  >
                    {/* Nom complet */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="name"
                        className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
                      >
                        Nom complet
                      </Label>
                      <div className="group relative">
                        <User className="absolute left-4 top-4 h-5 w-5 text-slate-300 transition-colors duration-300 group-focus-within:text-brand" />
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            clearFieldError("name");
                          }}
                          required
                          placeholder="Ex : Awa Dupont"
                          autoComplete="name"
                          disabled={loading}
                          aria-invalid={Boolean(fieldErrors.name)}
                          aria-describedby={
                            fieldErrors.name ? "name-error" : undefined
                          }
                          className={fieldInputClass(
                            Boolean(fieldErrors.name),
                            "pl-12",
                          )}
                        />
                      </div>
                      <FieldError id="name-error" message={fieldErrors.name} />
                    </div>

                    {/* Adresse e-mail */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="email"
                        className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
                      >
                        Adresse e-mail
                      </Label>
                      <div className="group relative">
                        <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-300 transition-colors duration-300 group-focus-within:text-brand" />
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
                          autoComplete="email"
                          disabled={loading}
                          aria-invalid={Boolean(fieldErrors.email)}
                          aria-describedby={
                            fieldErrors.email ? "email-error" : undefined
                          }
                          className={fieldInputClass(
                            Boolean(fieldErrors.email),
                            "pl-12",
                          )}
                        />
                      </div>
                      <FieldError id="email-error" message={fieldErrors.email} />
                    </div>

                    {/* Mot de passe */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="password"
                        className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
                      >
                        Mot de passe
                      </Label>
                      <div className="group relative">
                        <Lock className="absolute left-4 top-4 h-5 w-5 text-slate-300 transition-colors duration-300 group-focus-within:text-brand" />
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
                          autoComplete="new-password"
                          disabled={loading}
                          aria-invalid={Boolean(fieldErrors.password)}
                          aria-describedby={
                            fieldErrors.password ? "password-error" : undefined
                          }
                          className={fieldInputClass(
                            Boolean(fieldErrors.password),
                            "pl-12 pr-12",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-4 top-4 text-slate-300 transition-colors hover:text-brand"
                          aria-label={
                            showPassword
                              ? "Masquer le mot de passe"
                              : "Afficher le mot de passe"
                          }
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      <p className="pl-2 text-[11px] font-medium text-slate-400">
                        Au moins 8 caractères.
                      </p>
                      <FieldError
                        id="password-error"
                        message={fieldErrors.password}
                      />
                    </div>

                    {/* Confirmation du mot de passe */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="confirmPassword"
                        className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
                      >
                        Confirmer le mot de passe
                      </Label>
                      <div className="group relative">
                        <Lock className="absolute left-4 top-4 h-5 w-5 text-slate-300 transition-colors duration-300 group-focus-within:text-brand" />
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            clearFieldError("confirmPassword");
                          }}
                          required
                          placeholder="••••••••"
                          autoComplete="new-password"
                          disabled={loading}
                          aria-invalid={Boolean(fieldErrors.confirmPassword)}
                          aria-describedby={
                            fieldErrors.confirmPassword
                              ? "confirmPassword-error"
                              : undefined
                          }
                          className={fieldInputClass(
                            Boolean(fieldErrors.confirmPassword),
                            "pl-12 pr-12",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-4 top-4 text-slate-300 transition-colors hover:text-brand"
                          aria-label={
                            showConfirmPassword
                              ? "Masquer la confirmation du mot de passe"
                              : "Afficher la confirmation du mot de passe"
                          }
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      <FieldError
                        id="confirmPassword-error"
                        message={fieldErrors.confirmPassword}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      aria-busy={loading}
                      className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-none bg-gradient-to-r from-brand to-brand-dark text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-brand/10 transition-all duration-300 hover:-translate-y-0.5 hover:from-brand-dark hover:to-brand-dark hover:shadow-brand/20 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Création...
                        </>
                      ) : (
                        <>
                          Créer mon compte
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
                        </>
                      )}
                    </Button>

                    <p className="px-1 text-center text-[11px] font-medium leading-relaxed text-slate-400">
                      En créant un compte, vous acceptez nos{" "}
                      <Link
                        href="/legal/cgu"
                        className="font-bold text-slate-500 underline decoration-slate-200 underline-offset-2 transition-colors hover:text-brand"
                      >
                        conditions générales
                      </Link>{" "}
                      et notre{" "}
                      <Link
                        href="/legal/confidentialite"
                        className="font-bold text-slate-500 underline decoration-slate-200 underline-offset-2 transition-colors hover:text-brand"
                      >
                        politique de confidentialité
                      </Link>
                      .
                    </p>
                  </MotionForm>
                ) : (
                  /* ================= ÉTAPE 2 : VÉRIFICATION E-MAIL ================= */
                  <MotionForm
                    key="step2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    onSubmit={handleVerifyOtp}
                    noValidate
                    className="relative z-10 space-y-6"
                  >
                    <div className="space-y-2">
                      <Label
                        htmlFor="otp"
                        className="ml-1 block text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
                      >
                        Code de vérification (6 chiffres)
                      </Label>
                      <div className="group relative">
                        <ShieldCheck className="absolute left-4 top-4 h-5 w-5 text-slate-300 transition-colors duration-300 group-focus-within:text-brand" />
                        <Input
                          id="otp"
                          name="otp"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={otp}
                          onChange={handleOtpChange}
                          required
                          placeholder="0 0 0 0 0 0"
                          autoComplete="one-time-code"
                          disabled={loading}
                          aria-invalid={Boolean(fieldErrors.otp)}
                          aria-describedby={
                            fieldErrors.otp ? "otp-error" : undefined
                          }
                          className={fieldInputClass(
                            Boolean(fieldErrors.otp),
                            "pl-12 text-center text-xl font-black tracking-[0.3em]",
                          )}
                        />
                      </div>
                      <FieldError
                        id="otp-error"
                        message={fieldErrors.otp}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goBackToStepOne}
                        disabled={loading || resending}
                        className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-slate-200 text-xs font-black uppercase tracking-[0.2em] text-slate-500 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60"
                      >
                        <ArrowLeft className="h-4 w-4 text-slate-400" />
                        Retour
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading || resending}
                        aria-busy={loading}
                        className="flex h-14 flex-[2] items-center justify-center gap-2 rounded-2xl border-none bg-gradient-to-r from-brand to-brand-dark text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-brand/10 transition-all duration-300 hover:-translate-y-0.5 hover:from-brand-dark hover:to-brand-dark hover:shadow-brand/20 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Vérification...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" />
                            Vérifier
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex flex-col items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading || resending || resendCooldown > 0}
                        className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors focus:outline-none ${
                          resendCooldown > 0
                            ? "cursor-not-allowed text-slate-300"
                            : "text-slate-400 hover:text-brand"
                        }`}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${
                            resending ? "animate-spin text-brand" : ""
                          }`}
                        />
                        {resending
                          ? "Renvoi en cours..."
                          : resendCooldown > 0
                            ? `Renvoyer le code (dans ${resendCooldown}s)`
                            : "Renvoyer le code"}
                      </button>
                    </div>
                  </MotionForm>
                )}
              </AnimatePresence>
            </div>

            {/* Pied de carte : lien vers la connexion */}
            <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-100/80 pt-6">
              <Link
                href="/auth"
                className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-brand transition-colors hover:text-brand-dark"
              >
                <LogIn className="h-3.5 w-3.5" />
                Déjà un compte ? Se connecter
              </Link>
              <Link
                href="/"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-brand"
              >
                ← Retour au portail
              </Link>
            </div>
          </section>
        </div>
      </Card>

      {/* Overlay de redirection */}
      <AnimatePresence>
        {isRedirecting && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/85 backdrop-blur-2xl"
          >
            <div className="relative flex h-28 w-28 items-center justify-center">
              <MotionSpan
                className="absolute inset-0 rounded-full border-2 border-transparent border-b-brand border-t-brand"
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  duration: 1.4,
                  ease: "linear",
                }}
              />
              <MotionSpan
                className="absolute inset-3 rounded-full border-2 border-transparent border-l-brand-dark border-r-brand-dark"
                animate={{ rotate: -360 }}
                transition={{
                  repeat: Infinity,
                  duration: 1.1,
                  ease: "linear",
                }}
              />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/30">
                <GraduationCap className="h-7 w-7 text-white" />
              </div>
            </div>
            <p className="mt-8 animate-pulse text-sm font-black uppercase tracking-[0.2em] text-brand-dark">
              Ouverture de votre espace...
            </p>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}
