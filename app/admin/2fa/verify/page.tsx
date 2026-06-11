"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, Mail, Smartphone, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function Admin2FAVerifyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [method, setMethod] = useState<"totp" | "email" | "backup">("totp");
  const [emailSent, setEmailSent] = useState(false);

  // Verify TOTP
  const handleVerifyTOTP = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError("Entrez un code à 6 chiffres");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await authClient.twoFactor.verifyTotp({
        code: totpCode,
        trustDevice: true,
      });

      if (authError) {
        setError(authError.message || "Code invalide");
        return;
      }

      toast.success("Vérification réussie !");
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Send OTP via email
  const handleSendEmailOTP = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await authClient.twoFactor.sendOtp();

      if (authError) {
        setError(authError.message || "Échec de l'envoi du code");
        return;
      }

      setEmailSent(true);
      toast.success("Code envoyé par email !");
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP email
  const handleVerifyEmailOTP = async () => {
    if (!emailCode || emailCode.length !== 6) {
      setError("Entrez un code à 6 chiffres");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await authClient.twoFactor.verifyOtp({
        code: emailCode,
        trustDevice: true,
      });

      if (authError) {
        setError(authError.message || "Code invalide");
        return;
      }

      toast.success("Vérification réussie !");
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Verify backup code
  const handleVerifyBackup = async () => {
    if (!backupCode) {
      setError("Entrez un code de secours");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await authClient.twoFactor.verifyBackupCode({
        code: backupCode,
        trustDevice: true,
      });

      if (authError) {
        setError(authError.message || "Code de secours invalide");
        return;
      }

      toast.success("Vérification réussie !");
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4">
      <Card className="bg-white rounded-2xl shadow-2xl w-full max-w-md px-10 py-12 border border-amber-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Vérification 2FA</h1>
          <p className="text-slate-500 text-sm mt-2">
            Entrez le code de vérification en deux étapes
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={method} onValueChange={(v) => setMethod(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="totp" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">App</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Secours</span>
            </TabsTrigger>
          </TabsList>

          {/* TOTP Verification */}
          <TabsContent value="totp">
            <div className="space-y-4">
              <div>
                <Label htmlFor="totp" className="text-sm font-medium text-gray-700">
                  Code de l'application d'authentification
                </Label>
                <Input
                  id="totp"
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="mt-1.5 h-11 text-center text-2xl tracking-widest font-mono"
                />
              </div>
              <Button
                onClick={handleVerifyTOTP}
                disabled={loading || totpCode.length !== 6}
                className="w-full h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5 mr-2" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" />
                    Vérifier
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Email OTP Verification */}
          <TabsContent value="email">
            <div className="space-y-4">
              {!emailSent ? (
                <Button
                  onClick={handleSendEmailOTP}
                  disabled={loading}
                  className="w-full h-11"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5 mr-2" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Envoyer le code par email
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <div>
                    <Label htmlFor="email-code" className="text-sm font-medium text-gray-700">
                      Code reçu par email
                    </Label>
                    <Input
                      id="email-code"
                      type="text"
                      maxLength={6}
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="mt-1.5 h-11 text-center text-2xl tracking-widest font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Valide pendant 5 minutes
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleVerifyEmailOTP}
                      disabled={loading || emailCode.length !== 6}
                      className="flex-1 h-11"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin w-5 h-5 mr-2" />
                          Vérification...
                        </>
                      ) : (
                        "Vérifier"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSendEmailOTP}
                      disabled={loading}
                    >
                      Renvoyer
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Backup Code Verification */}
          <TabsContent value="backup">
            <div className="space-y-4">
              <div>
                <Label htmlFor="backup" className="text-sm font-medium text-gray-700">
                  Code de secours
                </Label>
                <Input
                  id="backup"
                  type="text"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="Entrez un code de secours"
                  className="mt-1.5 h-11"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Les codes de secours sont à usage unique
                </p>
              </div>
              <Button
                onClick={handleVerifyBackup}
                disabled={loading || !backupCode}
                className="w-full h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5 mr-2" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" />
                    Vérifier
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Problèmes avec la 2FA ? Contactez l'administrateur système
          </p>
        </div>
      </Card>
    </div>
  );
}
