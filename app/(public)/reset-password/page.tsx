"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  AuthLayout,
  AuthHeader,
  AuthFooter,
  FormField,
  FormAlert,
  OtpInput,
  PasswordField,
  StepIndicator,
  SubmitButton,
  SuccessState,
  FIELD_INPUT_CLASS,
} from "@/components/auth";
import { cn } from "@/lib/utils";

/** État du jeton déduit du message serveur (#358). */
function tokenState(
  raw: string,
): "expired" | "used" | "invalid" | "unknown" {
  const msg = raw.toLowerCase();
  if (msg.includes("expir")) return "expired";
  if (
    msg.includes("used") ||
    msg.includes("déjà utilisé") ||
    msg.includes("deja utilis")
  )
    return "used";
  if (msg.includes("invalid") || msg.includes("incorrect") || msg.includes("otp"))
    return "invalid";
  return "unknown";
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Gérer l'email provenant de la page forgot-password
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
      setStep("otp");
    }
  }, [searchParams]);

  const handleSendOTP = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailError("");
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Veuillez entrer une adresse e-mail valide.");
      return;
    }

    setLoading(true);
    try {
      const { error: authError } =
        await authClient.emailOtp.requestPasswordReset({
          email: email.trim(),
        });

      if (authError) {
        setError(authError.message || "Échec de l'envoi du code");
        toast.error(authError.message || "Échec de l'envoi du code");
      } else {
        setStep("otp");
        toast.success("Code envoyé !", {
          description: "Vérifiez votre boîte de réception.",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOtpError("");
    setPasswordError("");
    setError("");

    if (!/^\d{6}$/.test(otp)) {
      setOtpError("Le code doit comporter exactement 6 chiffres.");
      return;
    }

    if (password.length < 8) {
      setPasswordError("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await authClient.emailOtp.resetPassword({
        email,
        otp,
        password,
      });

      if (authError) {
        const raw = authError.message || "Échec de la réinitialisation";
        const state = tokenState(raw);
        if (state === "expired") {
          const message =
            "Ce code a expiré. Recommencez la demande pour recevoir un nouveau code.";
          setError(message);
          toast.error(message);
        } else if (state === "used") {
          const message =
            "Ce code a déjà été utilisé. Recommencez la demande pour recevoir un nouveau code.";
          setError(message);
          toast.error(message);
        } else if (state === "invalid") {
          setOtpError("Ce code est invalide. Vérifiez les chiffres puis réessayez.");
          toast.error("Code invalide. Vérifiez puis réessayez.");
        } else {
          setError(raw);
          toast.error(raw);
        }
      } else {
        setSuccess(true);
        toast.success("Mot de passe modifié !", {
          description: "Vous pouvez maintenant vous connecter à votre espace.",
        });
        setTimeout(() => {
          router.push("/auth");
        }, 2000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const header =
    step === "email"
      ? {
          kicker: "Mot de passe oublié ?",
          title: "Réinitialiser votre mot de passe",
          description:
            "Entrez l'adresse e-mail associée à votre compte pour recevoir un code.",
        }
      : {
          kicker: "Code FSA",
          title: "Nouveau mot de passe",
          description:
            "Saisissez le code à 6 chiffres reçu par e-mail, puis choisissez un nouveau mot de passe.",
        };

  return (
    <AuthLayout label="Réinitialisation du mot de passe">
      {success ? (
        <SuccessState
          title="Mot de passe modifié !"
          description="Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter."
          actionLabel="Se connecter"
          actionHref="/auth"
        />
      ) : (
        <>
          <StepIndicator
            step={step === "email" ? 1 : 2}
            steps={["E-mail", "Nouveau mot de passe"]}
            label="Progression de la réinitialisation"
          />

          <AuthHeader
            kicker={header.kicker}
            title={header.title}
            description={header.description}
            email={step === "otp" ? email : undefined}
          />

          {error && (
            <div className="mb-5 space-y-3">
              <FormAlert variant="error" title="Une action est requise">
                {error}
              </FormAlert>
              {(error.includes("Recommencez") || error.includes("expiré")) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError("");
                    setOtp("");
                    setStep("email");
                  }}
                  className="h-12 w-full rounded-xl border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                  Recommencer la demande
                </Button>
              )}
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendOTP} noValidate className="space-y-5">
              <FormField id="email" label="Adresse e-mail" error={emailError}>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    required
                    placeholder="votre@email.com"
                    autoComplete="email"
                    disabled={loading}
                    aria-invalid={Boolean(emailError) || undefined}
                    aria-describedby={emailError ? "email-error" : undefined}
                    className={cn(
                      FIELD_INPUT_CLASS,
                      "pl-11",
                      emailError && "border-red-400",
                    )}
                  />
                </div>
              </FormField>

              <SubmitButton loading={loading} loadingLabel="Envoi du code...">
                Envoyer le code
              </SubmitButton>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} noValidate className="space-y-5">
              <FormField
                id="otp"
                label="Code de vérification"
                centerLabel
                error={otpError}
                hint="Code à 6 chiffres reçu par e-mail. Il expire dans 10 minutes."
              >
                <OtpInput
                  id="otp"
                  value={otp}
                  onChange={(value) => {
                    setOtp(value);
                    setOtpError("");
                  }}
                  disabled={loading}
                  hasError={Boolean(otpError)}
                  describedBy={otpError ? "otp-error" : undefined}
                />
              </FormField>

              <FormField
                id="password"
                label="Nouveau mot de passe"
                error={passwordError}
                hint={
                  !passwordError ? "Au moins 8 caractères." : undefined
                }
              >
                <PasswordField
                  id="password"
                  value={password}
                  onChange={(value) => {
                    setPassword(value);
                    setPasswordError("");
                  }}
                  placeholder="Minimum 8 caractères"
                  autoComplete="new-password"
                  disabled={loading}
                  hasError={Boolean(passwordError)}
                  describedBy={passwordError ? "password-error" : undefined}
                  showPassword={showPassword}
                  onToggleVisibility={() => setShowPassword((v) => !v)}
                  toggleLabel={{
                    show: "Afficher le mot de passe",
                    hide: "Masquer le mot de passe",
                  }}
                />
              </FormField>

              <FormField
                id="confirmPassword"
                label="Confirmer le mot de passe"
              >
                <PasswordField
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Retapez votre mot de passe"
                  autoComplete="new-password"
                  disabled={loading}
                  hasError={Boolean(passwordError)}
                  showPassword={showConfirm}
                  onToggleVisibility={() => setShowConfirm((v) => !v)}
                  toggleLabel={{
                    show: "Afficher la confirmation",
                    hide: "Masquer la confirmation",
                  }}
                />
              </FormField>

              <SubmitButton
                loading={loading}
                loadingLabel="Modification..."
              >
                Réinitialiser le mot de passe
              </SubmitButton>

              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setOtp("");
                    setStep("email");
                  }}
                  disabled={loading}
                  className="inline-flex min-h-[44px] items-center gap-2 px-2 text-sm text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Modifier l'adresse e-mail
                </button>
              </div>
            </form>
          )}

          <AuthFooter
            links={[
              {
                href: "/auth",
                label: "Retour à la connexion",
                primary: true,
              },
              { href: "/", label: "Retour au portail" },
            ]}
          />
        </>
      )}
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2
            className="h-10 w-10 animate-spin text-brand"
            aria-label="Chargement..."
          />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
