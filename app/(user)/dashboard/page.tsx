"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Clock, CheckCircle, Award, LogOut, User, Calendar, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserDashboardPage() {
  const router = useRouter();

  // Fetch user profile
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth");
        }
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's attestations
  const { data: attestations, isLoading: attLoading } = useQuery({
    queryKey: ["user-attestations"],
    queryFn: async () => {
      const res = await fetch("/api/user/attestations");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Déconnecté avec succès");
    router.push("/");
  };

  const handleDownload = async (code: string) => {
    toast.success(`Téléchargement de l'attestation ${code}...`);
    // TODO: Implement PDF download
  };

  if (userLoading) {
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
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">FSA</span>
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Espace Candidat</h1>
              <p className="text-xs text-slate-500">Ferme St André</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{user?.name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome Card */}
        <Card className="p-6 bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Bonjour {user?.name || 'Candidat'} ! 👋</h2>
              <p className="text-emerald-100">
                Retrouvez vos attestations et informations personnelles
              </p>
            </div>
            <Award className="w-16 h-16 text-white opacity-20" />
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total attestations</p>
                <p className="text-2xl font-bold text-slate-800">{attestations?.length || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Validées</p>
                <p className="text-2xl font-bold text-blue-600">
                  {attestations?.filter((a: any) => a.status === "VALIDATED").length || 0}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">En attente</p>
                <p className="text-2xl font-bold text-amber-600">
                  {attestations?.filter((a: any) => a.status === "PENDING").length || 0}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Personal Info */}
        <Card className="p-6 bg-white shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-500" />
            Informations personnelles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <User className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Nom complet</p>
                <p className="font-medium text-slate-800">{user?.name || "-"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium text-slate-800">{user?.email || "-"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Date de naissance</p>
                <p className="font-medium text-slate-800">
                  {user?.birthDate ? new Date(user.birthDate).toLocaleDateString("fr-FR") : "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <FileText className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Téléphone</p>
                <p className="font-medium text-slate-800">{user?.phone || "-"}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Attestations List */}
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Mes attestations
            </h3>
            <Badge variant="outline">{attestations?.length || 0}</Badge>
          </div>

          {attLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-slate-500">Chargement...</p>
            </div>
          ) : !attestations || attestations.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Aucune attestation</p>
              <p className="text-sm text-slate-500 mt-1">
                Vos attestations apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {attestations.map((att: any) => (
                <div
                  key={att.id}
                  className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{att.fullName}</p>
                        <p className="text-sm text-slate-500">
                          {att.formation?.name || "-"} • {att.type === "FORMATION" ? "Formation" : att.type === "STAGE" ? "Stage" : "Certification"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(att.issuedAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={
                        att.status === "VALIDATED" ? "bg-emerald-100 text-emerald-700" :
                        att.status === "REJECTED" ? "bg-rose-100 text-rose-700" :
                        "bg-amber-100 text-amber-700"
                      }>
                        {att.status === "VALIDATED" ? "Validée" : att.status === "REJECTED" ? "Rejetée" : "En attente"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(att.code)}
                        disabled={att.status !== "VALIDATED"}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
