"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { forgetPassword } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  AuthLayout,
  AuthHeader,
  AuthFooter,
  FormField,
  FormAlert,
  SubmitButton,
  FIELD_INPUT_CLASS,
} from "@/components/auth";
import { cn } from "@/lib/utils";

const EmailSchema = z.object({
  email: z.string().trim().email("Veuillez entrer une adresse e-mail valide."),
});

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setFieldError("");

    const parsed = EmailSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError("Veuillez entrer une adresse e-mail valide.");
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await forgetPassword({
        email: parsed.data.email,
      });

      if (authError) {
        // Message volontairement neutre : ne pas révéler l'existence du compte.
        const message =
          authError.message || "Impossible d'envoyer le code pour le moment.";
        setError(message);
        toast.error(message);
      } else {
        toast.success("Code envoyé !", {
          description: "Saisissez le code reçu pour continuer.",
        });
        // Rediriger vers la page de réinitialisation avec l'email pré-rempli
        router.push(
          `/reset-password?email=${encodeURIComponent(parsed.data.email)}`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout label="Demande de réinitialisation du mot de passe">
      <AuthHeader
        kicker="Mot de passe oublié ?"
        title="Réinitialiser votre mot de passe"
        description="Entrez l'adresse e-mail associée à votre compte. Vous recevrez un code à 6 chiffres."
      />

      {error && (
        <div className="mb-5">
          <FormAlert variant="error" title="Envoi impossible">
            {error}
          </FormAlert>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormField id="email" label="Adresse e-mail" error={fieldError}>
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
                setFieldError("");
              }}
              required
              placeholder="votre@email.com"
              autoComplete="email"
              disabled={loading}
              aria-invalid={Boolean(fieldError) || undefined}
              aria-describedby={fieldError ? "email-error" : undefined}
              className={cn(
                FIELD_INPUT_CLASS,
                "pl-11",
                fieldError && "border-red-400",
              )}
            />
          </div>
        </FormField>

        <SubmitButton loading={loading} loadingLabel="Envoi en cours...">
          Envoyer le code
        </SubmitButton>
      </form>

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
    </AuthLayout>
  );
}
