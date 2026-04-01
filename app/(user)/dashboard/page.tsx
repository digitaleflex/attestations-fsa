"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Clock, CheckCircle, Award, LogOut, User, Calendar, Mail, TrendingUp, BookOpen, Briefcase } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
          router.push("/admin/login");
        }
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's attestations
  const { data: attestationsData } = useQuery({
    queryKey: ["user-attestations"],
    queryFn: async () => {
      const res = await fetch("/api/user/attestations?limit=5");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch user's exams
  const { data: examsData } = useQuery({
    queryKey: ["user-exams"],
    queryFn: async () => {
      const res = await fetch("/api/user/exams");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch user statistics
  const { data: statsData } = useQuery({
    queryKey: ["user-statistics"],
    queryFn: async () => {
      const res = await fetch("/api/user/statistics");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
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
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
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
            <div className="hidden md:flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{user?.name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome Card */}
        <Card className="p-6 bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Bonjour {user?.name || 'Candidat'} ! 👋</h2>
              <p className="text-emerald-100">
                Retrouvez vos attestations, examens et informations personnelles
              </p>
            </div>
            <Award className="w-16 h-16 text-white opacity-20 hidden sm:block" />
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Attestations</p>
                <p className="text-2xl font-bold text-slate-800">{statsData?.overview?.totalAttestations || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Examens</p>
                <p className="text-2xl font-bold text-blue-600">{statsData?.overview?.totalExams || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Réussis</p>
                <p className="text-2xl font-bold text-purple-600">{statsData?.overview?.examsPassed || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Stages</p>
                <p className="text-2xl font-bold text-amber-600">{statsData?.overview?.internshipsAccepted || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Attestations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Attestations */}
            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Mes attestations
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{attestationsData?.attestations?.length || 0}</Badge>
                  <Link href="/user/attestations">
                    <Button variant="ghost" size="sm">Voir tout</Button>
                  </Link>
                </div>
              </div>

              {!attestationsData?.attestations || attestationsData.attestations.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">Aucune attestation</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Vos attestations apparaîtront ici
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {attestationsData.attestations.slice(0, 5).map((att: any) => (
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

            {/* Recent Exams */}
            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  Examens récents
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{examsData?.stats?.completed || 0}</Badge>
                  <Link href="/user/exams">
                    <Button variant="ghost" size="sm">Voir tout</Button>
                  </Link>
                </div>
              </div>

              {!examsData?.exams || examsData.exams.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">Aucun examen</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Vos examens apparaîtront ici
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {examsData.exams.slice(0, 3).map((exam: any) => (
                    <div
                      key={exam.id}
                      className="p-4 border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">{exam.examName}</p>
                          <p className="text-sm text-slate-500">
                            {exam.completedAt ? new Date(exam.completedAt).toLocaleDateString("fr-FR") : "En cours"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={
                            exam.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                            exam.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-700"
                          }>
                            {exam.status === "COMPLETED" ? "Terminé" : exam.status === "IN_PROGRESS" ? "En cours" : "Disponible"}
                          </Badge>
                          {exam.score !== null && (
                            <div className="text-right">
                              <p className="text-lg font-bold text-slate-800">{exam.score}%</p>
                              <p className="text-xs text-slate-500">Score</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column - Profile & Quick Actions */}
          <div className="space-y-6">
            {/* Personal Info */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                Mon profil
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <User className="w-5 h-5 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Nom complet</p>
                    <p className="font-medium text-slate-800 truncate">{user?.name || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="font-medium text-slate-800 truncate">{user?.email || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Téléphone</p>
                    <p className="font-medium text-slate-800 truncate">{user?.phone || "-"}</p>
                  </div>
                </div>
              </div>
              <Link href="/user/profile">
                <Button variant="outline" className="w-full mt-4">
                  Voir le profil
                </Button>
              </Link>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Actions rapides
              </h3>
              <div className="space-y-2">
                <Link href="/user/attestations" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <FileText className="w-4 h-4" />
                    Mes attestations
                  </Button>
                </Link>
                <Link href="/user/exams" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <BookOpen className="w-4 h-4" />
                    Passer un examen
                  </Button>
                </Link>
                <Link href="/user/internships" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Briefcase className="w-4 h-4" />
                    Candidatures stages
                  </Button>
                </Link>
                <Link href="/user/results" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Mes résultats
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Badges */}
            {statsData?.badges && statsData.badges.length > 0 && (
              <Card className="p-6 bg-white shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-500" />
                  Badges
                </h3>
                <div className="flex flex-wrap gap-2">
                  {statsData.badges.slice(0, 6).map((badge: any) => (
                    <Badge key={badge.id} variant="secondary" className="gap-1">
                      <span className="text-lg">{badge.icon}</span>
                      {badge.name}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
