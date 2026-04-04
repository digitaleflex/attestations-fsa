"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, UserPlus, Eye, EyeOff, Check, X, Mail, Phone, Calendar, MapPin, User, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";

// === Schémas de validation ===
const LoginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
  rememberMe: z.boolean().optional(),
});

const RegisterStep1Schema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins 1 majuscule")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins 1 minuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins 1 chiffre")
    .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir au moins 1 caractère spécial"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const RegisterStep2Schema = z.object({
  name: z.string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Le nom ne doit contenir que des lettres, espaces, tirets et apostrophes"),
  birthDate: z.string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Format JJ/MM/AAAA requis")
    .refine((val) => {
      const [day, month, year] = val.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      const now = new Date();
      const age = now.getFullYear() - date.getFullYear();
      const monthDiff = now.getMonth() - date.getMonth();
      const dayDiff = now.getDate() - date.getDate();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
      return actualAge >= 16 && actualAge <= 120;
    }, "Vous devez avoir entre 16 et 120 ans"),
  birthPlace: z.string()
    .min(2, "Le lieu de naissance est requis")
    .regex(/^[a-zA-ZÀ-ÿ\s,-]+$/, "Le lieu ne doit contenir que des lettres, espaces, virgules et tirets"),
});

const RegisterStep3Schema = z.object({
  phone: z.string()
    .min(8, "Numéro de téléphone invalide")
    .regex(/^[+]?[0-9\s.-]{8,15}$/, "Numéro de téléphone invalide (8-15 chiffres)"),
  address: z.string().optional(),
});

// === Indicateur de force du mot de passe ===
function PasswordStrengthIndicator({ password }: { password: string }) {
  const checks = [
    { label: "8 caractères minimum", valid: password.length >= 8 },
    { label: "1 majuscule", valid: /[A-Z]/.test(password) },
    { label: "1 minuscule", valid: /[a-z]/.test(password) },
    { label: "1 chiffre", valid: /[0-9]/.test(password) },
    { label: "1 caractère spécial", valid: /[^A-Za-z0-9]/.test(password) },
  ];

  const validCount = checks.filter((c) => c.valid).length;
  const strength = validCount / checks.length;

  const getStrengthColor = () => {
    if (strength <= 0.4) return "bg-red-500";
    if (strength <= 0.6) return "bg-yellow-500";
    if (strength <= 0.8) return "bg-blue-500";
    return "bg-emerald-500";
  };

  const getStrengthLabel = () => {
    if (strength <= 0.4) return "Faible";
    if (strength <= 0.6) return "Moyen";
    if (strength <= 0.8) return "Bon";
    return "Excellent";
  };

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Force du mot de passe</span>
        <span className={`font-medium ${strength <= 0.4 ? 'text-red-500' : strength <= 0.6 ? 'text-yellow-500' : strength <= 0.8 ? 'text-blue-500' : 'text-emerald-500'}`}>
          {getStrengthLabel()}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getStrengthColor()} transition-all duration-300`}
          style={{ width: `${strength * 100}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-1 mt-2">
        {checks.map((check, idx) => (
          <div key={idx} className={`flex items-center gap-1 text-xs ${check.valid ? 'text-emerald-600' : 'text-gray-400'}`}>
            {check.valid ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// === Wizard Step Indicator ===
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const steps = [
    { icon: Mail, label: "Compte" },
    { icon: User, label: "Infos" },
    { icon: Phone, label: "Contact" },
    { icon: Shield, label: "Validation" },
  ];

  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, idx) => {
        const StepIcon = step.icon;
        const isCompleted = idx + 1 < currentStep;
        const isCurrent = idx + 1 === currentStep;

        return (
          <div key={idx} className="flex flex-col items-center flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                isCompleted
                  ? "bg-emerald-500 text-white"
                  : isCurrent
                  ? "bg-emerald-100 text-emerald-600 ring-2 ring-emerald-500"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-4 h-4" />}
            </div>
            <span className={`text-xs mt-1 ${isCurrent ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// === Page Principale ===
export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const totalSteps = 4;

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    birthDate: "",
    birthPlace: "",
    phone: "",
    address: "",
    rememberMe: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    // Formatage automatique de la date (JJ/MM/AAAA)
    if (name === "birthDate") {
      let formatted = value.replace(/\D/g, ""); // Garde seulement les chiffres
      if (formatted.length > 8) formatted = formatted.slice(0, 8);
      
      // Ajoute les slashes automatiquement
      if (formatted.length >= 5) {
        formatted = `${formatted.slice(0, 2)}/${formatted.slice(2, 4)}/${formatted.slice(4)}`;
      } else if (formatted.length >= 3) {
        formatted = `${formatted.slice(0, 2)}/${formatted.slice(2)}`;
      }
      
      setForm((prev) => ({ ...prev, birthDate: formatted }));
      return;
    }
    
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    setFieldErrors({});
    let schema;
    if (step === 1) schema = RegisterStep1Schema;
    else if (step === 2) schema = RegisterStep2Schema;
    else if (step === 3) schema = RegisterStep3Schema;

    if (!schema) return true;

    const parse = schema.safeParse(form);
    if (!parse.success) {
      const errors: Record<string, string> = {};
      parse.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setFieldErrors(errors);
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(wizardStep)) {
      setWizardStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevStep = () => {
    setWizardStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    // Validation finale pour inscription
    if (!isLogin) {
      const allData = RegisterStep1Schema.safeParse(form);
      if (!allData.success) {
        setWizardStep(1);
        const errors: Record<string, string> = {};
        allData.error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setFieldErrors(errors);
        setError("Veuillez corriger les erreurs ci-dessous");
        toast.error("Certains champs contiennent des erreurs");
        setLoading(false);
        return;
      }
    }

    try {
      const submitData: any = {
        email: form.email,
        password: form.password,
        name: form.name,
        birthDate: form.birthDate ? (() => {
          // Convertir JJ/MM/AAAA en objet Date
          const [day, month, year] = form.birthDate.split('/').map(Number);
          return new Date(year, month - 1, day);
        })() : undefined,
        birthPlace: form.birthPlace,
        phone: form.phone,
        address: form.address,
      };

      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.message || (isLogin ? "Échec de la connexion" : "Échec de l'inscription");
        setError(errorMessage);
        toast.error(errorMessage);
        
        // Gestion des erreurs spécifiques
        if (errorMessage.includes("email") || errorMessage.includes("déjà")) {
          setWizardStep(1);
          setFieldErrors({ email: "Cette adresse email est déjà utilisée" });
        }
        if (errorMessage.includes("password") || errorMessage.includes("mot de passe")) {
          setWizardStep(1);
          setFieldErrors({ password: "Le mot de passe ne respecte pas les critères" });
        }
        
        setLoading(false);
        return;
      }

      const message = isLogin ? "Connexion réussie !" : "Compte créé avec succès !";
      toast.success(message);

      if (!isLogin) {
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
      }

      // Redirection selon le rôle
      if (data.user?.role === 'ADMIN') {
        router.push("/admin/dashboard");
      } else {
        router.push("/exams");
      }
    } catch (err: any) {
      console.error("Erreur lors de l'authentification:", err);
      const errorMessage = err.message || "Une erreur inattendue est survenue";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // === Formulaire de Connexion ===
  if (isLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 p-2 sm:p-4">
        <Card className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg lg:max-w-xl px-6 py-10 sm:px-12 sm:py-14 border border-gray-100 animate-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Bon retour !</h1>
            <p className="text-slate-500 text-sm mt-1">Connectez-vous à votre espace</p>
          </div>

          {/* Toggle Button */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setFieldErrors({});
                setError("");
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                isLogin
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LogIn className="w-4 h-4" />
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setFieldErrors({});
                setError("");
                setWizardStep(1);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                !isLogin
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Inscription
            </button>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="votre@email.com"
                  className={`pl-10 h-11 ${fieldErrors.email ? "border-red-500 focus:ring-red-500" : ""}`}
                  autoComplete="email"
                />
              </div>
              {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Mot de passe</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className={`pl-10 pr-10 h-11 ${fieldErrors.password ? "border-red-500 focus:ring-red-500" : ""}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={form.rememberMe}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-600">Se souvenir de moi</span>
              </label>
              <Link href="/admin/login" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                Mot de passe oublié ?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5 mr-2" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Pas encore de compte ?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  setFieldErrors({});
                  setError("");
                  setWizardStep(1);
                }}
                className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
              >
                Créer un compte
              </button>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <Link href="/" className="flex items-center justify-center text-sm text-gray-500 hover:text-gray-700">
              ← Retour à l&apos;accueil
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // === Formulaire d'Inscription (Wizard) ===
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 p-2 sm:p-4 py-8">
      <Card className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl lg:max-w-3xl px-6 py-10 sm:px-12 sm:py-14 border border-gray-100 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Créer un compte</h1>
          <p className="text-slate-500 text-sm mt-1">Rejoignez la plateforme FSA</p>
        </div>

        {/* Toggle Button */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setFieldErrors({});
              setError("");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all ${
              isLogin
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LogIn className="w-4 h-4" />
            Connexion
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setFieldErrors({});
              setError("");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all ${
              !isLogin
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Inscription
          </button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step Indicator */}
        <StepIndicator currentStep={wizardStep} totalSteps={totalSteps} />

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Étape 1: Compte */}
          {wizardStep === 1 && (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      placeholder="koffi.amadou@example.com"
                      className={`pl-10 h-11 ${fieldErrors.email ? "border-red-500" : ""}`}
                      autoComplete="email"
                    />
                  </div>
                  {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Mot de passe</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      required
                      placeholder="••••••••"
                      className={`pl-10 pr-10 h-11 ${fieldErrors.password ? "border-red-500" : ""}`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <PasswordStrengthIndicator password={form.password} />
                  {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirmer le mot de passe</Label>
                  <div className="relative mt-1.5">
                    <Shield className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="••••••••"
                      className={`pl-10 h-11 ${fieldErrors.confirmPassword ? "border-red-500" : ""}`}
                      autoComplete="new-password"
                    />
                  </div>
                  {fieldErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
                </div>
              </div>
            </>
          )}

          {/* Étape 2: Informations personnelles */}
          {wizardStep === 2 && (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">Nom complet</Label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      required
                      placeholder="Ex: Koffi Amadou"
                      className={`pl-10 h-11 ${fieldErrors.name ? "border-red-500" : ""}`}
                      autoComplete="name"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 ml-1">Tel qu&apos;il apparaît sur l&apos;acte de naissance</p>
                  {fieldErrors.name && <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="birthDate" className="text-sm font-medium text-gray-700">Date de naissance</Label>
                    <div className="relative mt-1.5">
                      <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                      <Input
                        id="birthDate"
                        name="birthDate"
                        type="text"
                        inputMode="numeric"
                        value={form.birthDate}
                        onChange={handleChange}
                        required
                        placeholder="JJ/MM/AAAA"
                        maxLength={10}
                        className={`pl-10 h-11 ${fieldErrors.birthDate ? "border-red-500" : ""}`}
                      />
                    </div>
                    {fieldErrors.birthDate && <p className="text-red-500 text-xs mt-1">{fieldErrors.birthDate}</p>}
                  </div>
                  <div>
                    <Label htmlFor="birthPlace" className="text-sm font-medium text-gray-700">Lieu de naissance</Label>
                    <div className="relative mt-1.5">
                      <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                      <Input
                        id="birthPlace"
                        name="birthPlace"
                        type="text"
                        value={form.birthPlace}
                        onChange={handleChange}
                        required
                        placeholder="Ex: Porto-Novo, Bénin"
                        className={`pl-10 h-11 ${fieldErrors.birthPlace ? "border-red-500" : ""}`}
                      />
                    </div>
                    {fieldErrors.birthPlace && <p className="text-red-500 text-xs mt-1">{fieldErrors.birthPlace}</p>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Étape 3: Contact */}
          {wizardStep === 3 && (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Téléphone</Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      required
                      placeholder="Ex: +229 95 12 34 56"
                      className={`pl-10 h-11 ${fieldErrors.phone ? "border-red-500" : ""}`}
                      autoComplete="tel"
                    />
                  </div>
                  {fieldErrors.phone && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
                </div>

                <div>
                  <Label htmlFor="address" className="text-sm font-medium text-gray-700">Adresse postale (optionnel)</Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    <Input
                      id="address"
                      name="address"
                      type="text"
                      value={form.address}
                      onChange={handleChange}
                      placeholder="Ex: Quartier Akpakpa, Rue 45, Cotonou"
                      className="pl-10 h-11"
                      autoComplete="street-address"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Étape 4: Validation */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Vérifiez vos informations
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-800">{form.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nom</span>
                    <span className="font-medium text-gray-800">{form.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date de naissance</span>
                    <span className="font-medium text-gray-800">{form.birthDate || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Lieu de naissance</span>
                    <span className="font-medium text-gray-800">{form.birthPlace || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Téléphone</span>
                    <span className="font-medium text-gray-800">{form.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Adresse</span>
                    <span className="font-medium text-gray-800">{form.address || '-'}</span>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                />
                <span className="text-sm text-gray-600">
                  J&apos;accepte les{" "}
                  <Link href="/conditions" className="text-emerald-600 hover:underline font-medium">
                    conditions d&apos;utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link href="/confidentialite" className="text-emerald-600 hover:underline font-medium">
                    politique de confidentialité
                  </Link>
                </span>
              </label>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-4">
            {wizardStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                className="flex-1 h-11 font-semibold border-gray-300 hover:bg-gray-50"
              >
                Retour
              </Button>
            )}
            {wizardStep < totalSteps ? (
              <Button
                type="button"
                onClick={handleNextStep}
                className="flex-1 h-11 font-semibold bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 shadow-md"
              >
                Suivant
              </Button>
            ) : (
              <Button
                type="submit"
                className="flex-1 h-11 font-semibold bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 shadow-md"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5 mr-2" />
                    Création du compte...
                  </>
                ) : (
                  "Créer mon compte"
                )}
              </Button>
            )}
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <Link href="/" className="flex items-center justify-center text-sm text-gray-500 hover:text-gray-700">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </Card>
    </div>
  );
}
