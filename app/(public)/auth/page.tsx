"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound, Mail, Lock, RefreshCw, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/error-translator";
import {
  AuthLayout,
  AuthHeader,
  AuthFooter,
  FormField,
  FormAlert,
  OtpInput,
  PasswordField,
  SubmitButton,
  FIELD_INPUT_CLASS,
} from "@/components/auth";
import { cn } from "@/lib/utils";

// Même règle que `app/api/auth/fsa-login` : l'identifiant est soit une adresse
// e-mail complète, soit un code FSA COMPLET. Les « 5 derniers caractères » ne
// sont pas un code et ne sont plus acceptés : cette recherche par suffixe
// ramenait l'espace de recherche du secret à 20 bits.
const MIN_FSA_IDENTIFIER_LENGTH = 8;
const FSA_IDENTIFIER_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FsaCodeSchema = z.object({
  fsaCode: z
    .string()
    .trim()
    .min(1, "Saisissez votre e-mail ou votre code FSA.")
    .max(50, "Le code saisi est trop long.")
    .refine(
      (value) =>
        FSA_IDENTIFIER_EMAIL.test(value) ||
        value.length >= MIN_FSA_IDENTIFIER_LENGTH,
      "Saisissez votre adresse e-mail complète ou votre code FSA complet (ex : FSA-2026-M01-00042-f0f9a). Un fragment du code n'est pas accepté.",
    ),
});

const OtpSchema = z.object({
  otp: z
    .string()
    .length(6, "Le code doit comporter exactement 6 chiffres.")
    .regex(/^\d{6}$/, "Le code ne doit contenir que des chiffres."),
});

const EmailSignInSchema = z.object({
  email: z.string().email("Veuillez entrer une adresse e-mail valide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

type LoginTab = "password" | "fsa";
type VerificationMode = "fsa" | "email";

/** Distingue code expiré / déjà utilisé pour un message actionnable (#358). */
function otpErrorKind(raw: string): "expired" | "used" | "invalid" {
  const msg = raw.toLowerCase();
  if (msg.includes("expir")) return "expired";
  if (
    msg.includes("déjà utilisé") ||
    msg.includes("deja utilis") ||
    msg.includes("already used") ||
    msg.includes("already-used") ||
    msg.includes("used")
  )
    return "used";
  return "invalid";
}

function otpErrorMessage(raw: string): string {
  const kind = otpErrorKind(raw);
  if (kind === "expired")
    return "Ce code a expiré. Demandez un nouveau code puis réessayez.";
  if (kind === "used")
    return "Ce code a déjà été utilisé. Demandez un nouveau code pour continuer.";
  return "Ce code est invalide. Vérifiez les chiffres puis réessayez.";
}

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

const TABS: Array<{ id: LoginTab; label: string; icon: typeof Lock }> = [
  { id: "password", label: "Mot de passe", icon: Lock },
  { id: "fsa", label: "Code FSA", icon: KeyRound },
];

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = getSafeCallbackUrl(
    searchParams?.get("callbackUrl") || searchParams?.get("callbackURL"),
  );

  // États de l'interface
  const [step, setStep] = useState<1 | 2>(1);
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

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const order: LoginTab[] = ["password", "fsa"];
    const current = order.indexOf(tab);
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = order[(current + delta + order.length) % order.length];
    switchTab(next);
    document.getElementById(`auth-tab-${next}`)?.focus();
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
          setVerificationMode("email");
          setStep(2);
          setOtp("");
          setError(
            "Votre adresse e-mail n'est pas encore vérifiée. Saisissez le code qui vient de vous être envoyé, ou demandez un nouveau code.",
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
      setVerificationMode("fsa");
      setStep(2);
      setOtp("");
      setResendCooldown(60); // Initialiser le cooldown à 60s
      toast.success("Code envoyé par e-mail !");
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
      toast.success("Nouveau code envoyé !");
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
      const { error: otpError } =
        await authClient.emailOtp.sendVerificationOtp({
          email: targetEmail,
          type: "email-verification",
        });

      if (otpError) throw otpError;

      setResendCooldown(60);
      if (showToast) toast.success("Nouveau code envoyé !");
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
      const raw = err instanceof Error ? err.message : "Code invalide.";
      const message = otpErrorMessage(translateAuthError(raw));
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
      const raw = err instanceof Error ? err.message : "Code invalide.";
      const message = otpErrorMessage(raw);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const goBackToStepOne = () => {
    setStep(1);
    setOtp("");
    setVerificationMode("fsa");
    setError("");
    setFieldErrors({});
  };

  const header =
    step === 1
      ? {
          kicker: "Espace candidat",
          title: "Se connecter",
          description: "Accédez à vos formations, examens et attestations.",
        }
      : {
          kicker: "Code FSA",
          title: "Vérifiez votre e-mail",
          description:
            "Nous avons envoyé un code à 6 chiffres à l'adresse suivante. Il expire dans 10 minutes.",
        };

  return (
    <AuthLayout label="Connexion à l'espace candidat">
      <AuthHeader
        kicker={header.kicker}
        title={header.title}
        description={header.description}
        email={step === 2 ? maskedEmail : undefined}
      />

      {error && (
        <div className="mb-5">
          <FormAlert variant="error" title="Une action est requise">
            {error}
          </FormAlert>
        </div>
      )}

      {step === 1 ? (
        /* ================= ÉTAPE 1 : CONNEXION ================= */
        <form
          onSubmit={
            tab === "password" ? handleEmailPasswordSubmit : handleRequestOtp
          }
          noValidate
          className="space-y-5"
        >
          <div
            role="tablist"
            aria-label="Méthode de connexion"
            onKeyDown={handleTabKeyDown}
            className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`auth-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`auth-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => switchTab(id)}
                className={cn(
                  "flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  tab === id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {tab === "password" ? (
            <div
              role="tabpanel"
              id="auth-panel-password"
              aria-labelledby="auth-tab-password"
              className="space-y-5"
            >
              <FormField
                id="email"
                label="Adresse e-mail"
                error={fieldErrors.email}
              >
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
                  aria-invalid={Boolean(fieldErrors.email) || undefined}
                  aria-describedby={
                    fieldErrors.email ? "email-error" : undefined
                  }
                  className={cn(
                    FIELD_INPUT_CLASS,
                    fieldErrors.email && "border-red-400",
                  )}
                />
              </FormField>

              <div>
                <FormField
                  id="password"
                  label="Mot de passe"
                  error={fieldErrors.password}
                >
                  <PasswordField
                    id="password"
                    value={password}
                    onChange={(value) => {
                      setPassword(value);
                      clearFieldError("password");
                    }}
                    autoComplete="current-password"
                    disabled={loading}
                    hasError={Boolean(fieldErrors.password)}
                    describedBy={
                      fieldErrors.password ? "password-error" : undefined
                    }
                    showPassword={showPassword}
                    onToggleVisibility={() => setShowPassword((v) => !v)}
                    toggleLabel={{
                      show: "Afficher le mot de passe",
                      hide: "Masquer le mot de passe",
                    }}
                  />
                </FormField>
                <div className="mt-1 flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              </div>

              <SubmitButton loading={loading} loadingLabel="Connexion...">
                Se connecter
              </SubmitButton>
            </div>
          ) : (
            <div
              role="tabpanel"
              id="auth-panel-fsa"
              aria-labelledby="auth-tab-fsa"
              className="space-y-5"
            >
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                Sans mot de passe : recevez un code à usage unique à
                l'adresse liée à votre dossier FSA.
              </p>
              <FormField
                id="fsaCode"
                label="E-mail ou code FSA"
                error={fieldErrors.fsaCode}
                hint="Votre code FSA complet figure sur votre relevé ou attestation (ex : FSA-2026-M01-00042-f0f9a)."
              >
                <Input
                  id="fsaCode"
                  name="fsaCode"
                  type="text"
                  value={fsaCode}
                  onChange={(e) => {
                    setFsaCode(e.target.value);
                    clearFieldError("fsaCode");
                  }}
                  required
                  placeholder="candidat@email.com ou FSA-2026-..."
                  autoComplete="off"
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.fsaCode) || undefined}
                  aria-describedby={
                    fieldErrors.fsaCode ? "fsaCode-error" : undefined
                  }
                  className={cn(
                    FIELD_INPUT_CLASS,
                    fieldErrors.fsaCode && "border-red-400",
                  )}
                />
              </FormField>

              <SubmitButton loading={loading} loadingLabel="Envoi du code...">
                Recevoir le code
              </SubmitButton>
            </div>
          )}
        </form>
      ) : (
        /* ================= ÉTAPE 2 : CODE FSA ================= */
        <form
          onSubmit={
            verificationMode === "email" ? handleVerifyEmailOtp : handleVerifyOtp
          }
          noValidate
          className="space-y-5"
        >
          <FormField
            id="otp"
            label="Code de vérification"
            centerLabel
            error={fieldErrors.otp}
            hint="Saisissez les 6 chiffres ou collez le code complet."
          >
            <OtpInput
              id="otp"
              value={otp}
              onChange={(value) => {
                setOtp(value);
                clearFieldError("otp");
              }}
              disabled={loading}
              hasError={Boolean(fieldErrors.otp)}
              describedBy={fieldErrors.otp ? "otp-error" : undefined}
            />
          </FormField>

          <SubmitButton loading={loading} loadingLabel="Vérification...">
            Vérifier et se connecter
          </SubmitButton>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={
                verificationMode === "email"
                  ? () => sendEmailVerificationOtp(maskedEmail, true)
                  : handleResendOtp
              }
              disabled={loading || resending || resendCooldown > 0}
              className="inline-flex min-h-[44px] items-center gap-2 px-2 text-sm font-semibold text-slate-600 transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn("h-4 w-4", resending && "animate-spin")}
              />
              {resending
                ? "Renvoi en cours..."
                : resendCooldown > 0
                  ? `Renvoyer le code (dans ${resendCooldown}s)`
                  : "Renvoyer le code"}
            </button>
            <button
              type="button"
              onClick={goBackToStepOne}
              disabled={loading || resending}
              className="inline-flex min-h-[44px] items-center gap-2 px-2 text-sm text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Modifier l'adresse e-mail
            </button>
          </div>
        </form>
      )}

      {step === 1 && (
        <AuthFooter
          links={[
            {
              href: "/inscription",
              label: "Pas encore de compte ? Créer un compte",
              primary: true,
            },
            { href: "/", label: "Retour au portail" },
          ]}
        />
      )}

      {isRedirecting && (
        <div
          role="status"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/90"
        >
          <Loader2
            className="h-8 w-8 animate-spin text-brand"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-slate-700">
            Ouverture de votre espace...
          </p>
        </div>
      )}
    </AuthLayout>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-50">
          <Loader2
            className="h-8 w-8 animate-spin text-brand"
            aria-label="Chargement..."
          />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
