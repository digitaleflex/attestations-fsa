"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
import { Loader2, User, Mail, Phone, MapPin, Calendar, Lock, CheckCircle, Edit2, Save, X, Shield } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminProfilePage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

  const { data: admin, isLoading } = useQuery({
    queryKey: ["admin-profile"],
    queryFn: async () => {
      const res = await fetch("/api/admin");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    birthDate: "",
    birthPlace: "",
    phone: "",
    address: "",
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useState(() => {
    if (admin) {
      setForm({
        name: admin.name || "",
        email: admin.email || "",
        birthDate: admin.birthDate || "",
        birthPlace: admin.birthPlace || "",
        phone: admin.phone || "",
        address: admin.address || "",
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      setLoading(false);
      return;
    }

    try {
      const updateData: Record<string, string> = {
        name: form.name,
        email: form.email,
        birthDate: form.birthDate,
        birthPlace: form.birthPlace,
        phone: form.phone,
        address: form.address,
      };

      if (form.newPassword) {
        updateData.oldPassword = form.oldPassword;
        updateData.newPassword = form.newPassword;
      }

      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de la mise à jour");
      }

      setSuccess("Profil mis à jour avec succès !");
      toast.success("Profil mis à jour !");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["admin-profile"] });
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Erreur inconnue");
      toast.error(error.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">👤 Mon Profil</h1>
            <p className="text-slate-500 mt-1">Gérez vos informations personnelles</p>
          </div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="gap-2 w-full sm:w-auto">
              <Edit2 className="w-4 h-4" />
              Modifier
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(false)} className="gap-2 w-full sm:w-auto">
              <X className="w-4 h-4" />
              Annuler
            </Button>
          )}
        </div>

        {/* Carte de profil */}
        <Card className="overflow-hidden">
          {/* En-tête coloré */}
          <div className="h-32 bg-gradient-to-r from-emerald-500 to-blue-600" />

          {/* Avatar et infos */}
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end -mt-12 gap-4">
              <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
                <User className="w-12 h-12 text-slate-400" />
              </div>
              <div className="flex-1 mt-8 sm:mt-0">
                <h2 className="text-2xl font-bold text-slate-800">{admin?.name || "Administrateur"}</h2>
                <p className="text-slate-500">{admin?.email}</p>
                <Badge className="mt-2 bg-emerald-100 text-emerald-700 border-emerald-200">
                  <Shield className="w-3 h-3 mr-1" />
                  Administrateur
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Onglets */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === "profile" ? "default" : "outline"}
            onClick={() => setActiveTab("profile")}
            className="gap-2"
          >
            <User className="w-4 h-4" />
            Informations personnelles
          </Button>
          <Button
            variant={activeTab === "security" ? "default" : "outline"}
            onClick={() => setActiveTab("security")}
            className="gap-2"
          >
            <Lock className="w-4 h-4" />
            Sécurité
          </Button>
        </div>

        {/* Formulaire */}
        <Card className="p-6 bg-white shadow-sm">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-6 border-emerald-200 bg-emerald-50">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <AlertTitle className="text-emerald-800">Succès</AlertTitle>
              <AlertDescription className="text-emerald-700">
                {success}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {activeTab === "profile" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                    👤 Nom complet
                  </Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                      id="name"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={cn("pl-10 h-11", !isEditing && "bg-slate-50")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                    📧 Email
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={cn("pl-10 h-11", !isEditing && "bg-slate-50")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="birthDate" className="text-sm font-semibold text-slate-700">
                    🎂 Date de naissance
                  </Label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <DateInput
                      id="birthDate"
                      name="birthDate"
                      value={form.birthDate}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={cn("pl-10 h-11", !isEditing && "bg-slate-50")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="birthPlace" className="text-sm font-semibold text-slate-700">
                    📍 Lieu de naissance
                  </Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                      id="birthPlace"
                      name="birthPlace"
                      value={form.birthPlace}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Ville, Pays"
                      className={cn("pl-10 h-11", !isEditing && "bg-slate-50")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-semibold text-slate-700">
                    📞 Téléphone
                  </Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                      id="phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="+229 ..."
                      className={cn("pl-10 h-11", !isEditing && "bg-slate-50")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" className="text-sm font-semibold text-slate-700">
                    🏠 Adresse
                  </Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                      id="address"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Votre adresse"
                      className={cn("pl-10 h-11", !isEditing && "bg-slate-50")}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Conseil :</strong> Utilisez un mot de passe fort avec au moins 8 caractères, une majuscule, une minuscule et un chiffre.
                  </p>
                </div>

                <div>
                  <Label htmlFor="oldPassword" className="text-sm font-semibold text-slate-700">
                    🔒 Ancien mot de passe
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                      id="oldPassword"
                      name="oldPassword"
                      type="password"
                      value={form.oldPassword}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="••••••••"
                      className={cn("pl-10 h-11", !isEditing && "bg-slate-50")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="newPassword" className="text-sm font-semibold text-slate-700">
                    🔑 Nouveau mot de passe
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      value={form.newPassword}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="••••••••"
                      className={cn("pl-10 h-11", !isEditing && "bg-slate-50")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
                    ✅ Confirmer le mot de passe
                  </Label>
                  <div className="relative mt-1">
                    <CheckCircle className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="••••••••"
                      className={cn("pl-10 h-11", !isEditing && "bg-slate-50")}
                    />
                  </div>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="flex gap-3 pt-6 border-t">
                <Button
                  type="submit"
                  disabled={loading}
                  className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Enregistrer les modifications
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    if (admin) {
                      setForm({
                        name: admin.name || "",
                        email: admin.email || "",
                        birthDate: admin.birthDate || "",
                        birthPlace: admin.birthPlace || "",
                        phone: admin.phone || "",
                        address: admin.address || "",
                        oldPassword: "",
                        newPassword: "",
                        confirmPassword: "",
                      });
                    }
                  }}
                >
                  Annuler
                </Button>
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
