"use client";

export const dynamic = "force-dynamic";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Clock,
  CheckCircle,
  Award,
  LogOut,
  User as UserIcon,
  Calendar,
  Mail,
  TrendingUp,
  BookOpen,
  Briefcase,
  Search,
  Activity,
  Trophy,
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Megaphone,
  Loader2 as LoaderIcon,
  Play,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Attestation, Notification } from "@/types";

interface UserStatistics {
  overview: {
    totalAttestations: number;
    examsPassed: number;
    totalExams: number;
    totalMockExams: number;
    mockExamsPassed: number;
    averageScore: number;
  };
}

type DashboardExamEntry = {
  id: string;
  examName: string;
  status: string;
  score: number;
  maxScore: number;
  finalScore: number | null;
  passingScore: number;
  passed: boolean;
  startedAt: string | null;
  completedAt: string | null;
  type: string;
};

export default function UserDashboardPage() {
  const router = useRouter();
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  // Fetch settings for branding
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch("/api/public/settings");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const handleSendVerification = async () => {
    setIsSendingVerification(true);
    try {
      const response = await fetch("/api/user/send-verification", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Échec de l'envoi");
      }

      toast.success("Succès !", {
        description: "Un email de vérification vous a été envoyé.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur d'envoi";
      toast.error(message || "Impossible d'envoyer l'email");
    } finally {
      setIsSendingVerification(false);
    }
  };

  // Fetch consolidated dashboard data
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ["user-dashboard-data"],
    queryFn: async () => {
      const res = await fetch("/api/user/dashboard-data");
      if (!res.ok) {
        if (res.status === 401) router.push("/auth");
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const user = dashboardData?.profile;
  const attestationsData = dashboardData?.attestations;
  const examsData = dashboardData?.exams;
  const notificationsData = dashboardData?.notifications;
  const statsData = dashboardData?.statistics;

  const userLoading = dashboardLoading;

  // Dernières notes : sessions corrigées (hors examens disponibles), via le contrat dashboard-data.
  const recentNotes: DashboardExamEntry[] = (examsData?.exams ?? [])
    .filter((ex: DashboardExamEntry) => ex.status !== "AVAILABLE")
    .slice(0, 3);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      refetchDashboard();
    } catch (err) {
      console.error("Mark as read error:", err);
    }
  };

  if (userLoading)
    return (
      <div className="min-h-screen flex items-center justify-center grayscale">
        <LoaderIcon className="animate-spin text-slate-300 w-8 h-8" />
      </div>
    );

  const hasPendingCorrection = (user?.correctionRequests?.length || 0) > 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Welcome Premium */}
      <Card className="p-8 bg-gradient-to-br from-slate-900 to-blue-900 text-white shadow-2xl relative overflow-hidden group border-none">
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-brand/10 rounded-full blur-3xl group-hover:bg-brand/20 transition-all duration-1000" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <Badge className="bg-brand/20 text-white border-none px-3 py-1 text-[10px] uppercase font-black tracking-widest mb-2">
              Espace Candidat
            </Badge>
            <h2 className="text-4xl font-black tracking-tighter">
              Bienvenue, {user?.name?.split(" ")[0] || "Candidat"} ! 👋
            </h2>
            <p className="text-blue-100/70 font-medium">
              Votre parcours continue. Retrouvez vos succès et vos prochaines
              étapes ici.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-500">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>
          </div>
        </div>
      </Card>

      {/* Section attestation prompt */}

      {/* 📢 Nouvelles de la Direction */}
      {notificationsData?.notifications &&
        notificationsData.notifications.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-rose-500" /> Annonces de la
                Direction
              </h3>
              {(notificationsData?.unreadCount || 0) > 0 && (
                <Badge className="bg-rose-500 text-white border-none animate-pulse">
                  {notificationsData?.unreadCount} nouvelle(s)
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notificationsData.notifications
                .filter((n: Notification) => !n.isRead)
                .map((notif: Notification) => (
                  <Card
                    key={notif.id}
                    className="p-5 border-none shadow-premium relative overflow-hidden transition-all bg-white border-l-4 border-l-rose-500 group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 text-sm">
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">
                          Posté le{" "}
                          {new Date(notif.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => markAsRead(notif.id)}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full h-8 w-8 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                        <span className="sr-only">Masquer</span>
                      </Button>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        )}

      {/* Profile Verification Module */}
      <Card
        className={`p-8 border-none shadow-premium relative overflow-hidden transition-all duration-500 ${
          hasPendingCorrection ? "bg-slate-100 grayscale-[0.3]" : "bg-white"
        }`}
      >
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <UserIcon size={120} />
        </div>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div
            className={`flex-1 space-y-4 ${hasPendingCorrection ? "opacity-60" : ""}`}
          >
            <div className="flex items-center gap-2">
              <Badge
                className={`${
                  hasPendingCorrection
                    ? "bg-amber-100 text-amber-700"
                    : "bg-brand/10 text-brand-dark"
                } border-none px-2 py-0.5 text-[9px] uppercase font-bold`}
              >
                {hasPendingCorrection ? "Demande en cours" : "Étape Importante"}
              </Badge>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {hasPendingCorrection
                  ? "Traitement de vos informations"
                  : "Vérifiez vos informations officielles"}
              </h3>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
              {hasPendingCorrection
                ? "Une demande de modification est actuellement entre les mains de nos administrateurs. Vos documents seront mis à jour dès validation."
                : "Avant que nous n'émettions vos documents officiels, assurez-vous que votre nom, date et lieu de naissance sont corrects. Ces informations apparaîtront telles quelles sur vos attestations."}
            </p>

            <div className="flex flex-wrap gap-4 py-2">
              <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">
                  Nom complet
                </span>
                <span className="font-bold text-slate-800">
                  {user?.name || "Non défini"}
                </span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">
                  Date de naissance
                </span>
                <span className="font-bold text-slate-800">
                  {user?.birthDate
                    ? new Date(user.birthDate).toLocaleDateString()
                    : "--/--/----"}
                </span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">
                  Lieu de naissance
                </span>
                <span className="font-bold text-slate-800">
                  {user?.birthPlace || "Non défini"}
                </span>
              </div>
              <div
                className={`px-4 py-2 rounded-xl border text-xs transition-all ${
                  user?.emailVerified
                    ? "bg-brand/10 border-brand/20"
                    : "bg-amber-50 border-amber-100 animate-pulse"
                }`}
              >
                <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">
                  Email vérifié
                </span>
                <div className="flex items-center gap-1.5">
                  {user?.emailVerified ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span
                    className={`font-black ${user?.emailVerified ? "text-brand-dark" : "text-amber-700"}`}
                  >
                    {user?.emailVerified ? "CONFIRMÉ" : "À VÉRIFIER"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {hasPendingCorrection ? (
                <div className="px-6 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm shadow-xl shadow-amber-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 animate-pulse" />
                  Traitement en cours...
                </div>
              ) : (
                <>
                  <Link href="/profile">
                    <Button className="bg-brand hover:bg-brand-dark h-11 px-6 rounded-xl font-bold shadow-lg shadow-brand/20">
                      Vérifier et Valider
                    </Button>
                  </Link>
                  <Link href="/profile">
                    <Button
                      variant="outline"
                      className="h-11 px-6 rounded-xl font-bold border-slate-200"
                    >
                      Signaler une erreur
                    </Button>
                  </Link>
                  {!user?.emailVerified && (
                    <Button
                      onClick={handleSendVerification}
                      disabled={isSendingVerification}
                      className="h-11 px-6 rounded-xl font-black bg-slate-900 text-white border-none shadow-xl hover:bg-black transition-all gap-2"
                    >
                      {isSendingVerification ? (
                        <LoaderIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      {isSendingVerification
                        ? "Envoi..."
                        : "Vérifier mon email"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Analytic & Records */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Attestations",
                val: statsData?.overview?.totalAttestations || 0,
                icon: FileText,
                bg: "bg-brand",
              },
              {
                label: "Réussites Off.",
                val: statsData?.overview?.examsPassed || 0,
                icon: CheckCircle,
                bg: "bg-brand-dark",
              },
              {
                label: "Examen Blanc",
                val: statsData?.overview?.totalMockExams || 0,
                icon: GraduationCap,
                bg: "bg-brand-accent",
              },
              {
                label: "Score Moyen",
                val: (statsData?.overview?.averageScore || 0) + "%",
                icon: TrendingUp,
                bg: "bg-amber-500",
              },
            ].map((s) => (
              <Card
                key={s.label}
                className="p-4 border-none shadow-premium bg-white flex items-center gap-3 hover:shadow-lg transition-all group overflow-hidden relative"
              >
                <div
                  className={`absolute top-0 right-0 w-12 h-12 ${s.bg} opacity-[0.03] rounded-bl-full group-hover:scale-[3] transition-transform duration-700`}
                />
                <div
                  className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center text-white shadow-lg flex-shrink-0`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">
                    {s.label}
                  </p>
                  <p className="text-xl font-black text-slate-900 truncate">
                    {s.val}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          {/* Exams Status Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Official Exam Status */}
            <Card className="p-6 border-none shadow-premium bg-white group hover:shadow-xl transition-all border-l-4 border-l-brand">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand" /> Session
                  Officielle
                </h3>
                <Link href="/exams">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] font-bold"
                  >
                    Détails
                  </Button>
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Examens officiels
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {statsData?.overview?.totalExams || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Réussites
                  </span>
                  <span className="text-sm font-black text-brand">
                    {statsData?.overview?.examsPassed || 0}
                  </span>
                </div>
                <Link href="/exams" className="block pt-2">
                  <Button className="w-full bg-slate-900 hover:bg-black h-10 rounded-xl text-[10px] font-black uppercase tracking-wider gap-2">
                    <Play className="w-3 h-3" /> Accéder à la session
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Mock Exam Status */}
            <Card className="p-6 border-none shadow-premium bg-white group hover:shadow-xl transition-all border-l-4 border-l-brand-accent">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-brand-accent" />{" "}
                  Auto-Évaluation
                </h3>
                <Link href="/exams">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] font-bold"
                  >
                    Détails
                  </Button>
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Entraînements
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {statsData?.overview?.totalMockExams || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Objectif atteint
                  </span>
                  <span className="text-sm font-black text-brand-accent">
                    {statsData?.overview?.mockExamsPassed || 0}
                  </span>
                </div>
                <Link href="/exams" className="block pt-2">
                  <Button
                    variant="outline"
                    className="w-full border-brand/20 text-brand-accent hover:bg-brand/10 h-10 rounded-xl text-[10px] font-black uppercase tracking-wider gap-2"
                  >
                    <Clock className="w-3 h-3" /> S'entraîner maintenant
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* My Attestations List */}
          <Card className="p-8 border-none shadow-premium bg-white">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 tracking-tighter">
                Mes Documents Officiels
              </h3>
              <Link href="/attestations">
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-bold text-brand"
                >
                  Tout voir
                </Button>
              </Link>
            </div>

            <div className="space-y-4">
              {!attestationsData?.attestations?.length ? (
                <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">
                    Aucune attestation disponible pour le moment.
                  </p>
                </div>
              ) : (
                attestationsData.attestations.map((att: Attestation) => (
                  <div
                    key={att.id}
                    className="p-5 bg-slate-50 rounded-2xl group hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-brand">
                          {att.type.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {att.fullName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {att.formation?.name || "Stage"} •{" "}
                            {new Date(att.issuedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {att.status === "VALIDATED" &&
                        (att.type === "FORMATION"
                          ? (att.certificationScore || 0) > 0
                          : (att.certificationScore || 0) > 0 &&
                            (att.stageScore || 0) > 0) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={true}
                            className="rounded-full bg-slate-50 text-slate-300 cursor-not-allowed"
                          >
                            <Download className="w-5 h-5" />
                          </Button>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant="outline"
                              className={`text-[9px] flex items-center gap-1 ${
                                att.status === "REJECTED"
                                  ? "bg-rose-50 text-rose-600 border-rose-200"
                                  : "bg-amber-50 text-amber-700 border-amber-100"
                              }`}
                            >
                              <ShieldAlert className="w-2.5 h-2.5" />
                              {att.status === "REJECTED"
                                ? "ATTESTATION RÉVOQUÉE"
                                : "SCORES EN ATTENTE"}
                            </Badge>
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest text-right">
                              {att.status === "REJECTED"
                                ? "Action administrative requise"
                                : "Validation en cours..."}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Barre de Progression Théorie + Stage */}
                    {att.status !== "REJECTED" && (
                      <div className="mt-4 pt-4 border-t border-slate-200/50 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" /> État du
                            Parcours FSA
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                (att.certificationScore || 0) >= 60
                                  ? "text-blue-500"
                                  : "text-slate-300"
                              }
                            >
                              Théorie{" "}
                              {(att.certificationScore || 0) >= 60 ? "✓" : "○"}
                            </span>
                            <span className="text-slate-200">|</span>
                            <span
                              className={
                                (att.stageScore || 0) >= 60
                                  ? "text-brand"
                                  : "text-slate-300"
                              }
                            >
                              Pratique {(att.stageScore || 0) >= 60 ? "✓" : "○"}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div
                            className={cn(
                              "p-2.5 rounded-xl border flex items-center justify-between transition-all",
                              (att.certificationScore || 0) >= 60
                                ? "bg-blue-50 border-blue-100"
                                : "bg-white border-slate-100 opacity-60",
                            )}
                          >
                            <span className="text-[9px] font-bold text-slate-500 uppercase">
                              Théorie
                            </span>
                            <span className="text-sm font-black text-brand-dark">
                              {((att.certificationScore || 0) / 5).toFixed(2)}
                              /20
                            </span>
                          </div>

                          {(att.certificationScore || 0) >= 60 ? (
                            (att.stageScore || 0) > 0 ? (
                              <div className="bg-brand/10 p-2.5 rounded-xl border border-brand/20 flex items-center justify-between">
                                <span className="text-[9px] font-bold text-brand uppercase">
                                  Stage
                                </span>
                                <span className="text-sm font-black text-brand-dark">
                                  {((att.stageScore || 0) / 5).toFixed(2)}/20
                                </span>
                              </div>
                            ) : (
                              <Link
                                href="/internships"
                                className="bg-gradient-to-r from-brand to-brand-dark p-2.5 rounded-xl text-white flex items-center justify-center gap-2 hover:from-brand-dark hover:to-brand-dark transition-all shadow-lg active:scale-95 shadow-brand/20"
                              >
                                <span className="text-[9px] font-black uppercase">
                                  Postuler au Stage
                                </span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            )
                          ) : (
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-center opacity-40">
                              <span className="text-[9px] font-bold text-slate-400 italic">
                                Stage (Bloqué)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {att.status === "REJECTED" && (
                      <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-rose-500" />
                        <p className="text-[11px] text-rose-600 font-medium leading-tight">
                          Cette attestation a été invalidée. Pour toute
                          contestation, merci de contacter le bureau de la Ferme
                          St André.
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Side Info */}
        <div className="space-y-8">
          {/* Progression Info */}
          <Card className="p-6 border-none shadow-premium bg-white">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Taux de Réussite
            </h3>
            <div className="flex flex-col items-center justify-center py-4">
              <div className="text-5xl font-black text-slate-900 tracking-tighter">
                {statsData?.overview?.totalExams
                  ? Math.round(
                      ((statsData?.overview?.examsPassed || 0) /
                        statsData.overview.totalExams) *
                        100,
                    )
                  : 0}
                %
              </div>
              <p className="text-sm font-medium text-slate-500 mt-2">
                Sur {statsData?.overview?.totalExams || 0} examens officiels
              </p>
            </div>
          </Card>

          {/* Recent Submissions (New) */}
          <Card className="p-6 border-none shadow-premium bg-white">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand" /> Vos Dernières
              Notes
            </h3>
            <div className="space-y-3">
              {recentNotes.length > 0 ? (
                recentNotes.map((ex) => {
                  // Pourcentage canonique fourni par l'API (finalScore, sessions corrigées).
                  const scorePercent =
                    typeof ex.finalScore === "number" ? ex.finalScore : 0;
                  const scoreOn20 = (scorePercent / 100) * 20;
                  const isGraded = ex.status === "COMPLETED";
                  const isPassed = isGraded && ex.passed;

                  return (
                    <div
                      key={ex.id}
                      className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-100 hover:shadow-xl hover:shadow-slate-200/50"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 transition-transform group-hover:scale-110",
                            isPassed
                              ? "bg-brand/10 text-brand"
                              : "bg-rose-100 text-rose-600",
                          )}
                        >
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight"
                            title={ex.examName}
                          >
                            {ex.examName || "Examen"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                              Le{" "}
                              {new Date(
                                ex.completedAt || ex.startedAt || "",
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <div
                          className={cn(
                            "text-lg font-black leading-none",
                            isPassed ? "text-brand" : "text-rose-600",
                          )}
                        >
                          {scoreOn20.toFixed(1)}/20
                        </div>
                        <Badge
                          className={cn(
                            "text-[8px] h-4 leading-none font-black uppercase tracking-tighter shadow-sm border-none",
                            isGraded
                              ? isPassed
                                ? "bg-brand text-white"
                                : "bg-rose-500 text-white"
                              : "bg-amber-100 text-amber-700",
                          )}
                        >
                          {isGraded
                            ? isPassed
                              ? "Admis"
                              : "Échec"
                            : "En correction"}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Activity className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                    Aucun examen passé
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Profile Card */}
          <Card className="p-8 border-none shadow-premium bg-white space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-black">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <p className="font-black text-slate-900 truncate tracking-tight">
                  {user?.name || "Utilisateur"}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <Link href="/exams">
                <Button className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl h-12 font-bold gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Session
                  Officielle
                </Button>
              </Link>
              <Link href="/exams">
                <Button
                  variant="outline"
                  className="w-full border-brand/20 text-brand hover:bg-brand/10 rounded-xl h-12 font-bold gap-2"
                >
                  <GraduationCap className="w-4 h-4" /> Examen Blanc
                </Button>
              </Link>
              <Link href="/profile">
                <Button
                  variant="ghost"
                  className="w-full rounded-xl h-10 font-bold text-slate-500 hover:text-slate-900"
                >
                  Gérer mon profil
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
