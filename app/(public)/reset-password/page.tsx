"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Eye, EyeOff, CheckCircle, ShieldCheck, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await authClient.emailOtp.requestPasswordReset({
        email,
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
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (otp.length !== 6) {
      setError("Le code doit contenir 6 chiffres");
      return;
    }

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
      const { error: authError } = await authClient.emailOtp.resetPassword({
        email,
        otp,
        password,
      });

      if (authError) {
        setError(authError.message || "Échec de la réinitialisation");
        toast.error(authError.message || "Échec de la réinitialisation");
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
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return { label: "À saisir", color: "bg-gray-200" };
    if (password.length < 8) return { label: "Trop court", color: "bg-red-500" };
    if (password.length < 12) return { label: "Moyen", color: "bg-amber-500" };
    return { label: "Fort", color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength();
  const passwordsMatch = password === confirmPassword && password.length >= 8;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 p-4">
      <Card className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md px-10 py-12 border border-gray-100 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg transform hover:scale-105 transition-transform">
            {success ? (
              <CheckCircle className="w-10 h-10 text-white" />
            ) : step === "otp" ? (
              <KeyRound className="w-10 h-10 text-white" />
            ) : (
              <ShieldCheck className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-800 text-center">
            {success
              ? "Mot de passe modifié !"
              : step === "otp"
              ? "Vérification OTP"
              : "Réinitialisation du mot de passe"}
          </h1>
          <p className="text-slate-500 text-sm mt-2 text-center px-4">
            {success
              ? "Redirection vers l'espace candidat..."
              : step === "otp"
              ? "Entrez le code à 6 chiffres reçu par email"
              : "Entrez votre email pour recevoir un code de vérification"}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 rounded-xl">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <p className="text-sm text-emerald-700">
                Votre mot de passe a été modifié avec succès.
              </p>
            </div>
            <Link href="/auth" className="block">
              <Button className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700">Se connecter</Button>
            </Link>
          </div>
        ) : step === "email" ? (
          <form onSubmit={handleSendOTP} className="space-y-6">
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
                  Envoi du code...
                </>
              ) : (
                "Envoyer le code de vérification"
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5">
            {/* OTP Input */}
            <div>
              <Label htmlFor="otp" className="text-sm font-medium text-gray-700 ml-1">
                Code de vérification
              </Label>
              <div className="relative mt-1.5">
                <KeyRound className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  placeholder="123456"
                  maxLength={6}
                  className="pl-12 h-12 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 text-center text-2xl font-mono tracking-widest"
                  autoComplete="one-time-code"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5 ml-1">
                Code à 6 chiffres reçu par email • Expire dans 10 min
              </p>
            </div>

            {/* New Password */}
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 ml-1">
                Nouveau mot de passe
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Minimum 8 caractères"
                  className="pl-12 pr-12 h-12 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Strength Indicator */}
              <div className="mt-3 flex items-center justify-between px-1">
                <div className="flex gap-1.5 flex-1 max-w-[60%]">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                        (password.length >= 8 && i === 1) ||
                        (password.length >= 10 && i <= 2) ||
                        (password.length >= 12 && i <= 3)
                          ? strength.color
                          : "bg-gray-100"
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${strength.color.replace('bg-', 'text-')}`}>
                  {strength.label}
                </span>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 ml-1">
                Confirmer le mot de passe
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Retapez votre mot de passe"
                  className={`pl-12 pr-12 h-12 rounded-xl border-gray-200 transition-all ${
                    confirmPassword && passwordsMatch
                      ? "border-emerald-500 ring-2 ring-emerald-500/10"
                      : confirmPassword
                      ? "border-red-300"
                      : ""
                  }`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && (
                <p className={`text-[11px] mt-1.5 ml-1 font-medium ${passwordsMatch ? "text-emerald-600" : "text-red-500"}`}>
                  {passwordsMatch ? "✓ Les mots de passe correspondent" : "✗ Les mots de passe ne correspondent pas"}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all rounded-xl disabled:opacity-50"
              disabled={loading || !passwordsMatch}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5 mr-2" />
                  Sécurisation...
                </>
              ) : (
                "Réinitialiser le mot de passe"
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl"
              onClick={() => setStep("email")}
            >
              <Mail className="w-4 h-4 mr-2" />
              Renvoyer le code
            </Button>
          </form>
        )}

        {!success && (
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center gap-3">
            <Link
              href="/forgot-password"
              className="text-xs text-gray-400 hover:text-emerald-600 transition-colors"
            >
              Code expiré ? Recommencer
            </Link>
            <Link
              href="/auth"
              className="flex items-center justify-center text-sm text-gray-600 hover:text-emerald-600 font-medium transition-all"
            >
              ← Retour à l&apos;espace candidat
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 p-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
