"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { forgetPassword } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await forgetPassword({
        email,
      });

      if (authError) {
        setError(authError.message || "Échec de l'envoi");
        toast.error(authError.message || "Échec de l'envoi");
      } else {
        toast.success("Code envoyé !", {
          description: "Redirection vers la saisie du code...",
        });
        // Rediriger vers la page de réinitialisation avec l'email pré-rempli
        router.push(`/admin/reset-password?email=${encodeURIComponent(email)}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 p-4">
      <Card className="bg-white rounded-2xl shadow-2xl w-full max-w-md px-10 py-12 border border-red-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            {sent ? (
              <CheckCircle className="w-10 h-10 text-white" />
            ) : (
              <Mail className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-800">
            {sent ? "Code envoyé !" : "Mot de passe oublié ?"}
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            {sent
              ? "Consultez votre boîte de réception pour le code OTP"
              : "Entrez votre email pour recevoir un code de vérification à 6 chiffres"}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-sm text-emerald-700">
                Un code de vérification à 6 chiffres a été envoyé à{" "}
                <strong>{email}</strong>
              </p>
              <p className="text-xs text-emerald-600 mt-2">
                Le code expire dans 10 minutes. Utilisez-le pour réinitialiser votre mot de passe.
              </p>
            </div>
            <Button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              variant="outline"
              className="w-full"
            >
              Renvoyer à une autre adresse
            </Button>
            <Link href="/admin/login">
              <Button variant="ghost" className="w-full text-slate-500">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à la connexion
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Adresse email
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@fsa.bj"
                  className="pl-10 h-11"
                  autoComplete="email"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md hover:shadow-lg transition-all"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5 mr-2" />
                  Envoi en cours...
                </>
              ) : (
                "Envoyer le code de vérification"
              )}
            </Button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <Link href="/admin/login" className="flex items-center justify-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour à la connexion
          </Link>
        </div>
      </Card>
    </div>
  );
}
