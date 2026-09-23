"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Shield,
  ShieldCheck,
  Copy,
  CheckCircle,
  AlertTriangle,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import QRCode from "react-qr-code";
import Link from "next/link";

export default function Admin2FASetupPage() {
  const [step, setStep] = useState<"setup" | "verify" | "success">("setup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"totp" | "email">("totp");

  // Enable 2FA
  const handleEnable2FA = async () => {
    if (!password) {
      setError("Le mot de passe est requis");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await authClient.twoFactor.enable({
        password,
      });

      if (authError) {
        setError(authError.message || "Échec de l'activation de la 2FA");
        return;
      }

      if (data) {
        if (data.method === "totp") {
          setTotpURI(data.totpURI);
          setBackupCodes(data.backupCodes || []);
        }
        setStep("verify");
        toast.success("2FA activée ! Vérifiez le code.");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Erreur inconnue");
      toast.error(error.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Verify TOTP code
  const handleVerifyTOTP = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Entrez un code à 6 chiffres");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await authClient.twoFactor.verifyTotp({
        code: verificationCode,
        trustDevice: true,
      });

      if (authError) {
        setError(authError.message || "Code invalide");
        return;
      }

      setStep("success");
      toast.success("2FA configurée avec succès !");
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Copy backup codes
  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Codes copiés dans le presse-papiers");
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand/5 via-brand/10 to-brand/15 p-4">
        <Card className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl px-10 py-12 border border-brand/20">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-brand to-brand-dark rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              2FA Configurée avec Succès !
            </h1>
            <p className="text-slate-500 mb-8">
              Votre compte administrateur est maintenant protégé par la
              vérification en deux étapes
            </p>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-emerald-900 mb-2">
                🔐 Méthodes de vérification disponibles :
              </h3>
              <ul className="text-left text-sm text-emerald-800 space-y-1">
                <li>✅ Application d'authentification (TOTP)</li>
                <li>✅ Code par email</li>
                <li>✅ Codes de secours ({backupCodes.length} restants)</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-center">
              <Link href="/admin/dashboard">
                <Button className="bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark">
                  Aller au Dashboard
                </Button>
              </Link>
              <Link href="/admin/settings">
                <Button variant="outline">Paramètres</Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand/5 via-brand/10 to-brand/15 p-4">
      <Card className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl px-4 sm:px-10 py-8 sm:py-12 border border-brand/20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-brand to-brand-dark rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">
            Configuration 2FA Admin
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            Sécurisez votre compte avec la vérification en deux étapes
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "setup" && (
          <div className="space-y-6">
            {/* Password Input */}
            <div>
              <Label
                htmlFor="password"
                className="text-sm font-medium text-gray-700"
              >
                Mot de passe actuel
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                className="mt-1.5 h-11"
              />
            </div>

            {/* Method Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                variant={method === "totp" ? "default" : "outline"}
                onClick={() => setMethod("totp")}
                className="h-20 flex flex-col items-center gap-2"
              >
                <QrCode className="w-6 h-6" />
                <span>Application Authenticator</span>
              </Button>
              <Button
                variant={method === "email" ? "default" : "outline"}
                onClick={() => setMethod("email")}
                className="h-20 flex flex-col items-center gap-2"
              >
                <Shield className="w-6 h-6" />
                <span>Code par Email</span>
              </Button>
            </div>

            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900">Important</AlertTitle>
              <AlertDescription className="text-amber-800">
                Après activation, vous devrez vérifier le code pour compléter la
                configuration. Sauvegardez vos codes de secours dans un endroit
                sécurisé.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleEnable2FA}
              disabled={loading || !password}
              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5 mr-2" />
                  Activation...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  Activer la 2FA
                </>
              )}
            </Button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-6">
            {/* QR Code */}
            {method === "totp" && totpURI && (
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4">
                  Scannez ce QR Code
                </h3>
                <div className="bg-white p-6 inline-block rounded-xl border-2 border-brand/20 mb-4">
                  <QRCode value={totpURI} size={200} />
                </div>
                <p className="text-sm text-slate-600">
                  Ouvrez Google Authenticator, Authy ou une application
                  similaire et scannez le code
                </p>
              </div>
            )}

            {/* Backup Codes */}
            {backupCodes.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">
                    🔑 Codes de Secours (SAUVEGARDEZ-LES !)
                  </h3>
                  <Button size="sm" variant="outline" onClick={copyBackupCodes}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copier
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((code, i) => (
                    <div
                      key={i}
                      className="bg-white px-3 py-2 rounded border border-slate-200"
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <Alert className="mt-4 bg-red-50 border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    Ces codes ne s'afficheront qu'une seule fois.
                    Sauvegardez-les dans un gestionnaire de mots de passe ou
                    imprimez-les.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Verification Code Input */}
            <div>
              <Label
                htmlFor="code"
                className="text-sm font-medium text-gray-700"
              >
                Code de vérification (6 chiffres)
              </Label>
              <Input
                id="code"
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, ""))
                }
                placeholder="000000"
                className="mt-1.5 h-11 text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleVerifyTOTP}
                disabled={loading || verificationCode.length !== 6}
                className="flex-1 h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5 mr-2" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Vérifier
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
