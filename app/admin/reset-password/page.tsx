"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Suspense } from "react";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Better Auth met le token dans l'URL après la redirection
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("Lien invalide ou expiré. Veuillez demander un nouveau lien.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (authError) {
        setError(authError.message || "Échec de la réinitialisation");
        toast.error(authError.message || "Échec de la réinitialisation");
      } else {
        setSuccess(true);
        toast.success("Mot de passe modifié !", {
          description: "Vous pouvez maintenant vous connecter.",
        });
        setTimeout(() => {
          router.push("/admin/login");
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

  const passwordsMatch = password === confirmPassword && password.length > 0;
  const passwordStrength =
    password.length >= 8
      ? password.length >= 12
        ? "Fort"
        : "Moyen"
      : "Faible";
  const strengthColor =
    password.length >= 12
      ? "text-emerald-500"
      : password.length >= 8
        ? "text-amber-500"
        : "text-red-500";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 p-4">
      <Card className="bg-white rounded-2xl shadow-2xl w-full max-w-md px-10 py-12 border border-red-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            {success ? (
              <CheckCircle className="w-10 h-10 text-white" />
            ) : (
              <Lock className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-800">
            {success
              ? "Mot de passe modifié !"
              : "Nouveau mot de passe"}
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            {success
              ? "Redirection en cours..."
              : "Choisissez un mot de passe sécurisé"}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-sm text-emerald-700">
                Votre mot de passe a été modifié avec succès.
              </p>
            </div>
            <Link href="/admin/login">
              <Button className="w-full">Se connecter</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Nouveau mot de passe
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Minimum 8 caractères"
                  className="pl-10 pr-10 h-11"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {password && (
                <div className="flex items-center justify-between mt-2 ml-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-8 rounded-full transition-colors ${
                          (i === 1 && password.length >= 8) ||
                          (i === 2 && password.length >= 12) ||
                          (i === 3 && password.length >= 16)
                            ? password.length >= 12
                              ? "bg-emerald-500"
                              : password.length >= 8
                                ? "bg-amber-500"
                                : "bg-red-500"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${strengthColor}`}>
                    {passwordStrength}
                  </span>
                </div>
              )}
            </div>

            <div>
              <Label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-gray-700"
              >
                Confirmer le mot de passe
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Retapez votre mot de passe"
                  className={`pl-10 pr-10 h-11 ${
                    confirmPassword && passwordsMatch
                      ? "border-emerald-500 focus-visible:ring-emerald-500"
                      : confirmPassword
                        ? "border-red-300"
                        : ""
                  }`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {confirmPassword && (
                <p
                  className={`text-xs mt-1 ml-1 ${
                    passwordsMatch ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {passwordsMatch ? "✓ Les mots de passe correspondent" : "✗ Les mots de passe ne correspondent pas"}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              disabled={loading || !token || !passwordsMatch}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5 mr-2" />
                  Réinitialisation...
                </>
              ) : (
                "Réinitialiser le mot de passe"
              )}
            </Button>
          </form>
        )}

        {!success && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <Link
              href="/admin/login"
              className="flex items-center justify-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Retour à la connexion
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 p-4">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
