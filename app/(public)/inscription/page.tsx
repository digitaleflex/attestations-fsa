"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/error-translator";
import { buildRegistrationConsents } from "@/lib/consent-types";
import {
  AuthLayout,
  AuthHeader,
  AuthFooter,
  FormField,
  FormAlert,
  OtpInput,
  StepIndicator,
  SubmitButton,
  FIELD_INPUT_CLASS,
} from "@/components/auth";
import { cn } from "@/lib/utils";

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

/**
 * Case à cocher de consentement.
 *
 * Il n'existe qu'UN seul cas d'usage à l'inscription : le marketing. Les
 * autres traitements (CGU, confidentialité, exécution du contrat) passent par
 * le clic sur « Créer mon compte » — voir le bloc clickwrap dans le rendu.
 *
 * Composant local plutôt qu'importé : il n'y a pas de `Checkbox` dans
 * `components/ui`, et cette case porte une sémantique légale propre.
 */
function ConsentCheckbox({
  id,
  checked,
  disabled,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-xs leading-relaxed transition-colors hover:bg-slate-50",
        disabled && "cursor-not-allowed opacity-70",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      />
      <span className="text-slate-600">{children}</span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function InscriptionPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
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

  // #153 — Consentement MARKETING uniquement.
  //
  // CGU, politique de confidentialité et traitement des données sont acceptés
  // par le clic sur « Créer mon compte » (clickwrap) : ils reposent sur
  // l'exécution du contrat (RGPD art. 6.1.b) et l'obligation d'information,
  // pas sur un consentement libre et révocable. Aucune case obligatoire, donc
  // aucun utilisateur bloqué à l'inscription.
  //
  // Le marketing, lui, EXIGE un consentement (art. 6.1.a) : case décochée par
  // défaut, jamais pré-cochée (une case pré-cochée est invalide — CJUE
  // Planet49).
  const [marketingConsent, setMarketingConsent] = useState(false);

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
      if (msg.includes("expir")) {
        return {
          message:
            "Ce code a expiré. Demandez un nouveau code puis réessayez.",
          field: "otp",
        };
      }
      if (
        msg.includes("used") ||
        msg.includes("déjà utilisé") ||
        msg.includes("deja utilis")
      ) {
        return {
          message:
            "Ce code a déjà été utilisé. Demandez un nouveau code pour continuer.",
          field: "otp",
        };
      }
      if (msg.includes("invalid") || msg.includes("incorrect") || msg.includes("otp")) {
        return {
          message:
            "Ce code est invalide. Vérifiez les chiffres puis réessayez.",
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

      // #153 — Enregistrement des consentements.
      //
      // La session n'existe qu'ici : `requireEmailVerification` est actif en
      // production (`lib/auth.ts:293`), donc `signUp.email` ne crée pas de
      // session, et `/api/user/after-signup` exige un utilisateur authentifié.
      //
      // Clickwrap : le clic sur « Créer mon compte » vaut acceptation des CGU,
      // de la politique de confidentialité et du traitement des données. On
      // écrit donc systématiquement ces trois lignes — c'est la preuve de
      // l'acceptation, pas une case à cocher. `MARKETING` n'est envoyé que si
      // la case a été cochée : envoyer `granted: false` pour un type non
      // révocable ferait échouer tout le lot en 422 (`lib/consent.ts:162`),
      // et l'absence de ligne vaut déjà refus côté `getConsentState`.
      const grantedConsents = buildRegistrationConsents(marketingConsent);

      try {
        const consentResponse = await fetch("/api/user/after-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consents: grantedConsents }),
        });
        if (!consentResponse.ok) {
          throw new Error(`HTTP ${consentResponse.status}`);
        }
      } catch (consentErr: unknown) {
        // Le compte est créé et l'e-mail vérifié : bloquer la redirection
        // laisserait la personne devant un écran mort, sans pouvoir réessayer
        // (l'OTP est consommé). On trace l'échec de façon exploitable.
        console.error("[SIGNUP_CONSENT_ERROR]", consentErr);
        toast.error(
          "Compte créé, mais l'enregistrement de vos consentements a échoué. Merci de le signaler au support.",
        );
      }

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
    setStep(1);
    setOtp("");
    setError("");
    setFieldErrors({});
  };

  /* ------------------------------------------------------------------ */
  /*                                Rendu                               */
  /* ------------------------------------------------------------------ */

  return (
    <AuthLayout label="Création d'un compte candidat">
      {/*
        Carte unique centrée, comme la connexion : pas de panneau latéral.
        Le formulaire reste pile au centre sur mobile comme sur desktop.
      */}
      <section>
        <StepIndicator step={step} label="Progression de l'inscription" />

          <AuthHeader
            kicker="Espace candidat"
            title={step === 1 ? "Créer un compte" : "Vérifiez votre e-mail"}
            description={
              step === 1
                ? "Accédez à vos formations, examens et attestations."
                : "Nous avons envoyé un code à 6 chiffres. Il expire dans 10 minutes."
            }
            email={step === 2 ? email : undefined}
          />

          {error && (
            <div className="mb-5">
              <FormAlert variant="error" title="Une action est requise">
                {error}
              </FormAlert>
            </div>
          )}

          {step === 1 ? (
            /* ================= ÉTAPE 1 : CRÉATION DU COMPTE ================= */
            <form onSubmit={handleSignUp} noValidate className="space-y-5">
              <FormField id="name" label="Nom complet" error={fieldErrors.name}>
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
                  aria-invalid={Boolean(fieldErrors.name) || undefined}
                  aria-describedby={
                    fieldErrors.name ? "name-error" : undefined
                  }
                  className={cn(
                    FIELD_INPUT_CLASS,
                    fieldErrors.name && "border-red-400",
                  )}
                />
              </FormField>

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
                  <div className="relative">
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
                      aria-invalid={Boolean(fieldErrors.password) || undefined}
                      aria-describedby={
                        fieldErrors.password ? "password-error" : undefined
                      }
                      className={cn(
                        FIELD_INPUT_CLASS,
                        "pr-12",
                        fieldErrors.password && "border-red-400",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </FormField>
                {!fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Au moins 8 caractères.
                  </p>
                )}
              </div>

              <FormField
                id="confirmPassword"
                label="Confirmation du mot de passe"
                error={fieldErrors.confirmPassword}
              >
                <div className="relative">
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
                    aria-invalid={
                      Boolean(fieldErrors.confirmPassword) || undefined
                    }
                    aria-describedby={
                      fieldErrors.confirmPassword
                        ? "confirmPassword-error"
                        : undefined
                    }
                    className={cn(
                      FIELD_INPUT_CLASS,
                      "pr-12",
                      fieldErrors.confirmPassword && "border-red-400",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label={
                      showConfirmPassword
                        ? "Masquer la confirmation du mot de passe"
                        : "Afficher la confirmation du mot de passe"
                    }
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </FormField>

              {/* #153 — Clickwrap : le clic sur « Créer mon compte » vaut
                  acceptation des CGU, de la politique de confidentialité et du
                  traitement des données. Aucune case obligatoire, donc aucun
                  utilisateur bloqué — l'acceptation est horodatée, versionnée
                  et conservée côté serveur (IP + user-agent).

                  Seul le marketing est une case, décochée par défaut : c'est
                  le seul traitement qui repose sur le consentement (RGPD
                  art. 6.1.a), et une case pré-cochée serait invalide. */}
              <ConsentCheckbox
                id="consent-marketing"
                checked={marketingConsent}
                disabled={loading}
                onChange={setMarketingConsent}
              >
                Recevoir les informations sur les formations et les événements (facultatif).
              </ConsentCheckbox>

              <p className="text-center text-xs leading-relaxed text-slate-500">
                En cliquant sur « Créer mon compte », vous acceptez nos{" "}
                <Link
                  href="/legal/cgu"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-slate-700 underline underline-offset-2 hover:text-brand"
                >
                  conditions générales d&apos;utilisation
                </Link>{" "}
                et notre{" "}
                <Link
                  href="/legal/confidentialite"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-slate-700 underline underline-offset-2 hover:text-brand"
                >
                  politique de confidentialité
                </Link>
                , ainsi que le traitement de vos données.
              </p>

              <SubmitButton loading={loading} loadingLabel="Création...">
                <span className="inline-flex items-center gap-2">
                  Créer mon compte
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </span>
              </SubmitButton>
            </form>
          ) : (
            /* ================= ÉTAPE 2 : VÉRIFICATION E-MAIL ================= */
            <form onSubmit={handleVerifyOtp} noValidate className="space-y-5">
              <FormField
                id="otp"
                label="Code de vérification"
                centerLabel
                error={fieldErrors.otp}
                hint="Saisissez les 6 chiffres ou collez le code complet. Pensez à vérifier vos spams."
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

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBackToStepOne}
                  disabled={loading || resending}
                  className="h-12 flex-1 rounded-xl border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  Retour
                </Button>
                <div className="flex-[2]">
                  <SubmitButton
                    loading={loading}
                    loadingLabel="Vérification..."
                    disabled={loading || resending}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                    Vérifier
                  </SubmitButton>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
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
                  className="inline-flex min-h-[44px] items-center px-2 text-sm text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                >
                  Modifier l'adresse e-mail
                </button>
              </div>
            </form>
          )}

          <AuthFooter
            links={[
              {
                href: "/auth",
                label: "Déjà inscrit ? Se connecter",
                primary: true,
              },
              { href: "/", label: "Retour au portail" },
            ]}
          />
      </section>

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
