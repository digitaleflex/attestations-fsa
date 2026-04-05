"use client";

import { useState } from "react";
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
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 p-4">
      <Card className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md px-10 py-12 border border-gray-100 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg transform hover:scale-105 transition-transform">
            {sent ? (
              <CheckCircle className="w-10 h-10 text-white" />
            ) : (
              <Mail className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-800 text-center">
            {sent ? "Email envoyé !" : "Mot de passe oublié ?"}
          </h1>
          <p className="text-slate-500 text-sm mt-2 text-center px-4">
            {sent
              ? "Consultez votre boîte de réception pour réinitialiser votre accès"
              : "Entrez votre email pour recevoir un code de vérification sécurisé"}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 rounded-xl">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <p className="text-sm text-emerald-700">
                Un code de vérification à 6 chiffres a été envoyé à{" "}
                <strong className="block mt-1 font-bold text-emerald-800">{email}</strong>
              </p>
              <p className="text-xs text-emerald-600/80 mt-3 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Le code expire dans 10 minutes.
              </p>
            </div>
            <Button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              variant="outline"
              className="w-full h-11 rounded-xl"
            >
              Renvoyer à une autre adresse
            </Button>
            <Link href="/auth" className="block">
              <Button variant="ghost" className="w-full text-slate-500 hover:text-emerald-600 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à la connexion
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 ml-1">
                Adresse email
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                  className="pl-12 h-12 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                  autoComplete="email"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5 mr-2" />
                  Envoi sécurisé...
                </>
              ) : (
                "Envoyer le code de vérification"
              )}
            </Button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <Link href="/auth" className="flex items-center justify-center text-sm text-gray-500 hover:text-emerald-600 font-medium transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour à l&apos;espace candidat
          </Link>
        </div>
      </Card>
    </div>
  );
}
