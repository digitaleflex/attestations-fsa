"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const RegisterSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export default function AdminRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error when user starts typing
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

    // Validation
    const parse = RegisterSchema.safeParse(form);
    if (!parse.success) {
      const errors: Record<string, string> = {};
      parse.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await authClient.signUp.email({
        email: form.email,
        password: form.password,
        name: form.name,
        role: "admin", // Forced role for this specific admin registration page
        callbackURL: "/admin/dashboard",
      } as any, {
        onRequest: () => setLoading(true),
        onResponse: () => setLoading(false),
        onError: (ctx) => {
          setError(ctx.error.message || "Échec de l'inscription");
          toast.error(ctx.error.message || "Échec de l'inscription");
        },
        onSuccess: () => {
          toast.success("Compte administrateur créé avec succès !");
          setIsRedirecting(true); // Déclenchement Vortex
          router.push("/admin/dashboard");
        }
      });

      if (authError) {
        setError(authError.message || "Échec de l'inscription");
        return;
      }
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
      toast.error(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50 p-4">
      <Card className="bg-white rounded-2xl shadow-xl w-full max-w-md px-12 py-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">📝</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Inscription Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Créez votre compte administrateur</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {Object.keys(fieldErrors).length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Veuillez corriger les erreurs</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-1">
                {Object.entries(fieldErrors).map(([field, msg]) => (
                  <li key={field}>{msg}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="name">Nom complet</Label>
            <Input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Jean Dupont"
              className={`input-style mt-1 ${fieldErrors.name ? "border-red-500" : ""}`}
              autoComplete="name"
            />
            {fieldErrors.name && <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="admin@fsa.bj"
              className={`input-style mt-1 ${fieldErrors.email ? "border-red-500" : ""}`}
              autoComplete="email"
            />
            {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              className={`input-style mt-1 ${fieldErrors.password ? "border-red-500" : ""}`}
              autoComplete="new-password"
            />
            {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              placeholder="••••••••"
              className={`input-style mt-1 ${fieldErrors.confirmPassword ? "border-red-500" : ""}`}
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
          </div>

          <Button
            type="submit"
            className="w-full py-6 text-base font-semibold bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Création du compte...
              </>
            ) : (
              "S'inscrire"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Déjà un compte ?{" "}
            <Link href="/admin/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Se connecter
            </Link>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <Link href="/" className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-700">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </Card>

      {/* Vortex Redirection Overlay */}
      {isRedirecting && (
        <div className="vortex-overlay" style={{ "--vortex-color-1": "#f59e0b", "--vortex-color-2": "#ea580c" } as any}>
          <div className="vortex-halo">
            <div className="vortex-ring" />
            <div className="vortex-ring-inner" />
            <div className="vortex-core">
               <span className="text-2xl">⚡</span>
            </div>
          </div>
          <p className="text-slate-800 font-bold text-xl animate-pulse">Veuillez patienter...</p>
          <p className="text-slate-500 text-sm mt-2">Création sécurisée de votre accès</p>
        </div>
      )}
    </div>
  );
}
