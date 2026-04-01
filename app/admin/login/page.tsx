"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Échec de la connexion");
        toast.error(data.message || "Échec de la connexion");
        return;
      }

      toast.success("Connexion réussie !");
      
      // Redirection selon le rôle
      if (data.user.role === 'ADMIN') {
        router.push("/admin/dashboard");
      } else {
        // User candidat - redirection vers l'accueil (pas d'accès admin)
        toast.info("Vous n'avez pas accès à l'interface admin");
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
      toast.error(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 p-4">
      <Card className="bg-white rounded-2xl shadow-2xl w-full max-w-md px-10 py-12 border border-red-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg transform hover:scale-105 transition-transform">
            <span className="text-4xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Administration FSA</h1>
          <p className="text-slate-500 text-sm mt-2">Espace réservé aux administrateurs</p>
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
                placeholder="admin@fsa.bj"
                className={`pl-10 h-11 ${form.email ? "" : ""}`}
                autoComplete="email"
              />
            </div>
            {form.email && (
              <p className="text-xs text-gray-400 mt-1 ml-1">Utilisez votre email administrateur</p>
            )}
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
                className="pl-10 pr-10 h-11"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-md hover:shadow-lg transition-all"
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

        <div className="mt-8 pt-6 border-t border-gray-100">
          <Link href="/" className="flex items-center justify-center text-sm text-gray-500 hover:text-gray-700">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </Card>
    </div>
  );
}
