"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, UserPlus, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/error-translator";

// === Schémas de validation ===
const LoginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
  rememberMe: z.boolean().optional(),
});

const RegisterSchema = z.object({
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

// === Page Principale ===
function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    rememberMe: false,
  });

  // Handle URL params for login/register mode
  useEffect(() => {
    const regMode = searchParams.get("register");
    if (regMode === "true") {
      setIsLogin(false);
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    if (!isLogin) {
      // === REGISTRATION ===
      const parse = RegisterSchema.safeParse(form);
      if (!parse.success) {
        const errors: Record<string, string> = {};
        parse.error.errors.forEach((err) => {
          if (err.path[0]) errors[err.path[0] as string] = err.message;
        });
        setFieldErrors(errors);
        setLoading(false);
        return;
      }

      try {
        const { data, error: authError } = await authClient.signUp.email({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.email.split("@")[0], // Default name from email
        });

        if (authError && Object.keys(authError).length > 0) throw authError;

        toast.success("Compte créé avec succès ! Bienvenue sur FSA.");
        setIsRedirecting(true);
        router.push("/dashboard");

      } catch (err: any) {
        console.error("DEBUG AUTH ERROR OBJECT:", JSON.stringify(err, null, 2));
        let message = "Une erreur inattendue est survenue";

        if (err instanceof Error) {
          message = translateAuthError(err.message);
        } else if (typeof err === "object" && err !== null) {
          message = err.message || 
                    err.error?.message || 
                    err.body?.message || 
                    err.error || 
                    JSON.stringify(err);
        }

        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    } else {
      // === LOGIN ===
      const parse = LoginSchema.safeParse(form);
      if (!parse.success) {
        const errors: Record<string, string> = {};
        parse.error.errors.forEach((err) => {
          if (err.path[0]) errors[err.path[0] as string] = err.message;
        });
        setFieldErrors(errors);
        setLoading(false);
        return;
      }

      try {
        const { data, error: authError } = await authClient.signIn.email({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });

        if (authError && Object.keys(authError).length > 0) throw authError;

        toast.success("Connexion réussie !");
        setIsRedirecting(true);
        if ((data?.user as any)?.role?.toLowerCase() === 'admin') {
          router.push("/admin/dashboard");
        } else {
          router.push("/dashboard");
        }
      } catch (err: any) {
        console.error("DEBUG AUTH ERROR OBJECT:", JSON.stringify(err, null, 2));
        let message = "Identifiants invalides";
        
        if (err instanceof Error) {
          message = translateAuthError(err.message);
        } else if (typeof err === "object" && err !== null) {
          message = err.message || 
                    err.error?.message || 
                    err.body?.message || 
                    err.error || 
                    JSON.stringify(err);
        }
        
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 p-2 sm:p-4">
      <Card className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg px-6 py-10 sm:px-12 sm:py-14 border border-gray-100 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            {isLogin ? <LogIn className="w-8 h-8 text-white" /> : <UserPlus className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{isLogin ? "Bon retour !" : "Créer un compte"}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isLogin ? "Connectez-vous à votre espace" : "Rejoignez la plateforme FSA"}
          </p>
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
              isLogin ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
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
              !isLogin ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
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
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
          </div>

          {!isLogin && (
            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirmer le mot de passe</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
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
          )}

          {isLogin && (
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
              <Link href="/forgot-password" title="password reset" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                Mot de passe oublié ?
              </Link>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 shadow-md transition-all"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                {isLogin ? "Connexion..." : "Création..."}
              </>
            ) : (
              isLogin ? "Se connecter" : "Créer mon compte"
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center gap-4">
          <p className="text-sm text-gray-500">
            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-emerald-600 hover:underline font-medium ml-1"
            >
              {isLogin ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </Card>

      {/* Vortex Redirection Overlay */}
      {isRedirecting && (
        <div className="vortex-overlay" style={{ "--vortex-color-1": "#10b981", "--vortex-color-2": "#2563eb" } as any}>
          <div className="vortex-halo">
            <div className="vortex-ring" />
            <div className="vortex-ring-inner" />
            <div className="vortex-core">
              <span className="text-2xl">{isLogin ? "🎓" : "✨"}</span>
            </div>
          </div>
          <p className="text-emerald-900 font-bold text-xl animate-pulse">Accès en cours...</p>
        </div>
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50">Chargement...</div>}>
      <AuthContent />
    </Suspense>
  );
}
