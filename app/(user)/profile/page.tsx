"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Phone, MapPin, Calendar, Lock, Save, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function UserProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        if (res.status === 401) router.push("/admin/login");
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useState(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setIsEditing(false);
      toast.success("Profil mis à jour avec succès !");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (showPasswordForm) {
      if (form.newPassword !== form.confirmPassword) {
        toast.error("Les mots de passe ne correspondent pas");
        return;
      }
      if (form.newPassword.length < 8) {
        toast.error("Le mot de passe doit contenir au moins 8 caractères");
        return;
      }
      updateMutation.mutate({
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });
    } else {
      updateMutation.mutate({
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Mon Profil</h1>
              <p className="text-xs text-slate-500">Gérez vos informations</p>
            </div>
          </div>
          <Link href="/user/dashboard">
            <Button variant="outline" size="sm">← Retour</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Info Card */}
        <Card className="p-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user?.name || "Candidat"}</h2>
              <p className="text-blue-100">{user?.email}</p>
              <Badge className="mt-2 bg-white/20 text-white border-white/30">
                {user?.role === "USER" ? "Candidat" : user?.role}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Form */}
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" />
              Informations personnelles
            </h3>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} size="sm">
                Modifier
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                <User className="w-4 h-4 inline mr-1" />
                Nom complet
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={!isEditing}
                className="mt-1.5 h-11"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={!isEditing}
                className="mt-1.5 h-11"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-semibold text-slate-700">
                <Phone className="w-4 h-4 inline mr-1" />
                Téléphone
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                disabled={!isEditing}
                className="mt-1.5 h-11"
              />
            </div>

            <div>
              <Label htmlFor="address" className="text-sm font-semibold text-slate-700">
                <MapPin className="w-4 h-4 inline mr-1" />
                Adresse
              </Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                disabled={!isEditing}
                className="mt-1.5 h-11"
              />
            </div>
          </div>

          {user?.birthDate && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date de naissance
                  </Label>
                  <p className="mt-1.5 text-sm text-slate-600">
                    {new Date(user.birthDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Lieu de naissance
                  </Label>
                  <p className="mt-1.5 text-sm text-slate-600">
                    {user.birthPlace || "-"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Password */}
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-500" />
              Sécurité
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowPasswordForm(!showPasswordForm);
                setIsEditing(true);
              }}
            >
              {showPasswordForm ? "Annuler" : "Changer le mot de passe"}
            </Button>
          </div>

          {showPasswordForm && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="oldPassword" className="text-sm font-semibold text-slate-700">
                  Ancien mot de passe
                </Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={form.oldPassword}
                  onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
                  className="mt-1.5 h-11"
                  required={showPasswordForm}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newPassword" className="text-sm font-semibold text-slate-700">
                    Nouveau mot de passe
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                    className="mt-1.5 h-11"
                    required={showPasswordForm}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
                    Confirmer le mot de passe
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="mt-1.5 h-11"
                    required={showPasswordForm}
                  />
                </div>
              </div>
              <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
                {updateMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Modification...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Changer le mot de passe
                  </>
                )}
              </Button>
            </form>
          )}

          {!showPasswordForm && (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <Lock className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Mot de passe actuel</p>
                <p className="text-xs text-slate-500">••••••••</p>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
