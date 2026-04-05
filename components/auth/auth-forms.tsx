'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { getCsrfTokenClient, fetchWithCsrf } from "@/lib/csrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Lock, UserPlus, LogIn, Github } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/admin/dashboard",
      });

      if (error) {
        setError(error.message || "Identifiants invalides");
        toast.error("Erreur de connexion", { description: error.message });
      } else {
        toast.success("Ravi de vous revoir !", { description: "Connexion réussie." });
        router.push("/admin/dashboard");
      }
    } catch (err) {
      setError("Une erreur inattendue est survenue");
      toast.error("Erreur système", { description: "Impossible de se connecter." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center tracking-tight">Connexion Admin</CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Entrez vos identifiants pour accéder au tableau de bord
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                className="pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full font-semibold transition-all hover:scale-[1.02]" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connexion en cours...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Se connecter
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/admin/signup" className="text-primary hover:underline font-medium">
            S'inscrire
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Sanitize name input
    const sanitizedName = name.trim().replace(/[<>{}()]/g, "");
    if (sanitizedName.length < 2) {
      setError("Le nom doit contenir au moins 2 caractères");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name: sanitizedName,
        callbackURL: "/admin/dashboard",
      });

      if (error) {
        const errorMsg = error.message || "Email ou mot de passe invalide";
        setError(errorMsg);
        toast.error("Erreur d'inscription", { description: errorMsg });
      } else {
        toast.success("Bienvenue à la FSA !", { description: "Votre compte a été créé avec succès." });
        router.push("/admin/dashboard");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Une erreur inattendue est survenue";
      setError(errorMsg);
      toast.error("Erreur système", { description: "Impossible de créer le compte." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center tracking-tight">Créer un compte</CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Rejoignez la plateforme FSA dès maintenant
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nom complet</Label>
            <div className="relative">
              <UserPlus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="Jean Dupont"
                className="pl-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="jean@example.com"
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                className="pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full font-semibold transition-all hover:scale-[1.02]" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inscription en cours...
              </>
            ) : (
               <>
                <UserPlus className="mr-2 h-4 w-4" />
                S'inscrire
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          Déjà un compte ?{" "}
          <Link href="/admin/login" className="text-primary hover:underline font-medium">
            Se connecter
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
