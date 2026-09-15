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
  Rocket,
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
  portfolio: {
    completedMissions: number;
    totalMissions: number;
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
  const statsData: UserStatistics | undefined = dashboardData?.statistics;

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
      <Card className="p-8 rounded-card bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-900 text-white shadow-lifted relative overflow-hidden group border-none">
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl group-hover:bg-emerald-400/30 transition-all duration-1000" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <Badge className="bg-white/15 text-emerald-100 border-none px-3 py-1 rounded-pill text-[10px] uppercase font-extrabold tracking-widest mb-2">
              Espace Candidat
            </Badge>
            <h2 className="text-4xl font-extrabold tracking-tight">
              Bienvenue, {user?.name?.split(" ")[0] || "Candidat"}
            </h2>
            <p className="text-emerald-50/80 font-medium">
              Votre parcours continue. Retrouvez vos succès et vos prochaines
              étapes ici.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-card bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-soft group-hover:rotate-6 transition-transform duration-500">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>
          </div>
        </div>
      </Card>

      {/* Portfolio Journey (New) */}
      <Card className="p-6 rounded-card border border-line shadow-soft bg-white relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-action bg-blue-50 flex items-center justify-center text-ocean-strong shadow-sm shrink-0">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-ink tracking-tight">
                VOTRE PARCOURS PROFESSIONNEL
              </h3>
              <p className="text-[10px] text-ink-muted font-bold uppercase tracking-widest">
                Missions validées :{" "}
                {statsData?.portfolio?.completedMissions || 0} /{" "}
                {statsData?.portfolio?.totalMissions || 0}
              </p>
            </div>
          </div>

          {/* Badge Display */}
          {(statsData?.portfolio?.completedMissions || 0) > 0 && (
            <div
              className={cn(
                "px-4 py-2 rounded-action flex items-center gap-2 shadow-sm border animate-in zoom-in duration-500",
                (statsData?.portfolio?.completedMissions || 0) >= 6
                  ? "bg-amber-400 border-amber-500 text-amber-950"
                  : (statsData?.portfolio?.completedMissions || 0) >= 3
                    ? "bg-slate-200 border-slate-300 text-slate-800"
                    : "bg-amber-200 border-amber-300 text-amber-950",
              )}
            >
              <Trophy className="w-4 h-4" />
              <span className="text-[10px] font-extrabold uppercase">
                {(statsData?.portfolio?.completedMissions || 0) >= 6
                  ? "Rang Or"
                  : (statsData?.portfolio?.completedMissions || 0) >= 3
                    ? "Rang Argent"
                    : "Rang Bronze"}
              </span>
            </div>
          )}

          <div className="flex-1 max-w-md w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-ocean-strong">
                PROGRESSION
              </span>
              <span className="text-[10px] font-extrabold text-ocean-strong">
                {statsData?.portfolio?.totalMissions
                  ? Math.round(
                      ((statsData?.portfolio?.completedMissions || 0) /
                        statsData.portfolio.totalMissions) *
                        100,
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 bg-blue-50 rounded-pill overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-ocean-strong to-brand transition-all duration-1000"
                style={{
                  width: `${statsData?.portfolio?.totalMissions ? Math.round(((statsData?.portfolio?.completedMissions || 0) / statsData.portfolio.totalMissions) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
          <Link href="/internships">
            <Button className="bg-ocean-strong hover:bg-blue-700 h-10 px-6 rounded-action font-extrabold text-[10px] uppercase tracking-wider">
              Continuer mes missions
            </Button>
          </Link>
        </div>
      </Card>

      {/* Section Relevé de Notes Prompt (New) */}
      {(statsData?.overview?.totalExams || 0) > 0 && (
        <Card className="p-6 rounded-card border-none shadow-soft bg-gradient-to-r from-ocean-strong to-blue-800 text-white relative overflow-hidden group animate-in slide-in-from-right duration-700">
          <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-1000" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-card bg-white/20 flex items-center justify-center text-white shadow-sm shrink-0 backdrop-blur-md border border-white/10">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-extrabold text-white tracking-tight text-lg mb-1 uppercase">
                  Votre relevé de notes est prêt
                </h3>
                <p className="text-blue-50/85 text-sm font-medium max-w-xl">
                  Votre parcours académique a été validé. Vous pouvez dès
                  maintenant télécharger votre relevé de notes officiel certifié
                  par la direction.
                </p>
              </div>
            </div>
            <Link href="/transcript">
              <Button className="bg-white text-ocean-strong hover:bg-blue-50 h-12 px-8 rounded-action font-extrabold text-sm uppercase tracking-wider shadow-lifted flex items-center gap-2 group/btn">
                Voir mon relevé de notes
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Nouvelles de la Direction */}
      {notificationsData?.notifications &&
        notificationsData.notifications.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-extrabold text-ink-muted uppercase tracking-widest flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-500" /> Annonces de la
                Direction
              </h3>
              {(notificationsData?.unreadCount || 0) > 0 && (
                <Badge className="bg-harvest text-white border-none rounded-pill animate-pulse">
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
                    className="p-5 rounded-card border border-line shadow-soft relative overflow-hidden transition-all bg-white border-l-4 border-l-harvest group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-bold text-ink text-sm">
                          {notif.title}
                        </p>
                        <p className="text-xs text-ink-muted leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="text-[9px] text-ink-muted font-bold uppercase mt-2">
                          Posté le{" "}
                          {new Date(notif.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => markAsRead(notif.id)}
                        className="text-slate-400 hover:text-ink hover:bg-surface-muted rounded-pill h-8 w-8 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
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
        className={`p-8 rounded-card border border-line shadow-soft relative overflow-hidden transition-all duration-500 ${
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
                    : "bg-blue-100 text-ocean-strong"
                } border-none px-2 py-0.5 rounded-pill text-[9px] uppercase font-bold`}
              >
                {hasPendingCorrection ? "Demande en cours" : "Étape Importante"}
              </Badge>
              <h3 className="text-xl font-extrabold text-ink tracking-tight">
                {hasPendingCorrection
                  ? "Traitement de vos informations"
                  : "Vérifiez vos informations officielles"}
              </h3>
            </div>
            <p className="text-ink-muted text-sm leading-relaxed max-w-2xl">
              {hasPendingCorrection
                ? "Une demande de modification est actuellement entre les mains de nos administrateurs. Vos documents seront mis à jour dès validation."
                : "Avant que nous n'émettions vos documents officiels, assurez-vous que votre nom, date et lieu de naissance sont corrects. Ces informations apparaîtront telles quelles sur vos attestations."}
            </p>

            <div className="flex flex-wrap gap-4 py-2">
              <div className="px-4 py-2 rounded-action bg-surface-muted border border-line text-xs">
                <span className="block text-ink-muted font-bold uppercase text-[9px] mb-1">
                  Nom complet
                </span>
                <span className="font-bold text-ink">
                  {user?.name || "Non défini"}
                </span>
              </div>
              <div className="px-4 py-2 rounded-action bg-surface-muted border border-line text-xs">
                <span className="block text-ink-muted font-bold uppercase text-[9px] mb-1">
                  Date de naissance
                </span>
                <span className="font-bold text-ink">
                  {user?.birthDate
                    ? new Date(user.birthDate).toLocaleDateString()
                    : "--/--/----"}
                </span>
              </div>
              <div className="px-4 py-2 rounded-action bg-surface-muted border border-line text-xs">
                <span className="block text-ink-muted font-bold uppercase text-[9px] mb-1">
                  Lieu de naissance
                </span>
                <span className="font-bold text-ink">
                  {user?.birthPlace || "Non défini"}
                </span>
              </div>
              <div
                className={`px-4 py-2 rounded-action border text-xs transition-all ${
                  user?.emailVerified
                    ? "bg-emerald-50 border-emerald-100"
                    : "bg-amber-50 border-amber-100 animate-pulse"
                }`}
              >
                <span className="block text-ink-muted font-bold uppercase text-[9px] mb-1">
                  Email vérifié
                </span>
                <div className="flex items-center gap-1.5">
                  {user?.emailVerified ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span
                    className={`font-extrabold ${user?.emailVerified ? "text-emerald-700" : "text-amber-700"}`}
                  >
                    {user?.emailVerified ? "CONFIRMÉ" : "À VÉRIFIER"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {hasPendingCorrection ? (
                <div className="px-6 py-2.5 rounded-action bg-harvest text-white font-bold text-sm shadow-soft flex items-center gap-2">
                  <Clock className="w-4 h-4 animate-pulse" />
                  Traitement en cours...
                </div>
              ) : (
                <>
                  <Link href="/profile">
                    <Button className="bg-ocean-strong hover:bg-blue-700 h-11 px-6 rounded-action font-bold shadow-soft">
                      Vérifier et Valider
                    </Button>
                  </Link>
                  <Link href="/profile">
                    <Button
                      variant="outline"
                      className="h-11 px-6 rounded-action font-bold border-line"
                    >
                      Signaler une erreur
                    </Button>
                  </Link>
                  {!user?.emailVerified && (
                    <Button
                      onClick={handleSendVerification}
                      disabled={isSendingVerification}
                      className="h-11 px-6 rounded-action font-extrabold bg-ink text-white border-none shadow-soft hover:bg-slate-800 transition-all gap-2"
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
                bg: "bg-ocean-strong",
              },
              {
                label: "Réussites Off.",
                val: statsData?.overview?.examsPassed || 0,
                icon: CheckCircle,
                bg: "bg-brand",
              },
              {
                label: "Examen Blanc",
                val: statsData?.overview?.totalMockExams || 0,
                icon: GraduationCap,
                bg: "bg-harvest",
              },
              {
                label: "Score Moyen",
                val: (statsData?.overview?.averageScore || 0) + "%",
                icon: TrendingUp,
                bg: "bg-ink",
              },
            ].map((s) => (
              <Card
                key={s.label}
                className="p-4 rounded-card border border-line shadow-soft bg-white flex items-center gap-3 hover:shadow-lifted transition-all group overflow-hidden relative"
              >
                <div
                  className={`absolute top-0 right-0 w-12 h-12 ${s.bg} opacity-[0.03] rounded-bl-full group-hover:scale-[3] transition-transform duration-700`}
                />
                <div
                  className={`w-10 h-10 rounded-action ${s.bg} flex items-center justify-center text-white shadow-soft flex-shrink-0`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-extrabold text-ink-muted uppercase tracking-widest truncate">
                    {s.label}
                  </p>
                  <p className="text-xl font-extrabold text-ink truncate">
                    {s.val}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          {/* Exams Status Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Official Exam Status */}
            <Card className="p-6 rounded-card border border-line shadow-soft bg-white group hover:shadow-lifted transition-all border-l-4 border-l-ocean-strong">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-ink-muted uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-ocean-strong" /> Session
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
                  <span className="text-xs font-bold text-ink-muted uppercase">
                    Examens officiels
                  </span>
                  <span className="text-sm font-extrabold text-ink">
                    {statsData?.overview?.totalExams || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-muted uppercase">
                    Réussites
                  </span>
                  <span className="text-sm font-extrabold text-emerald-600">
                    {statsData?.overview?.examsPassed || 0}
                  </span>
                </div>
                <Link href="/exams" className="block pt-2">
                  <Button className="w-full bg-ink hover:bg-slate-800 h-10 rounded-action text-[10px] font-extrabold uppercase tracking-wider gap-2">
                    <Play className="w-3 h-3" /> Accéder à la session
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Mock Exam Status */}
            <Card className="p-6 rounded-card border border-line shadow-soft bg-white group hover:shadow-lifted transition-all border-l-4 border-l-harvest">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-ink-muted uppercase tracking-widest flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-amber-600" />{" "}
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
                  <span className="text-xs font-bold text-ink-muted uppercase">
                    Entraînements
                  </span>
                  <span className="text-sm font-extrabold text-ink">
                    {statsData?.overview?.totalMockExams || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-muted uppercase">
                    Objectif atteint
                  </span>
                  <span className="text-sm font-extrabold text-amber-600">
                    {statsData?.overview?.mockExamsPassed || 0}
                  </span>
                </div>
                <Link href="/exams" className="block pt-2">
                  <Button
                    variant="outline"
                    className="w-full border-amber-100 text-amber-600 hover:bg-amber-50 h-10 rounded-action text-[10px] font-extrabold uppercase tracking-wider gap-2"
                  >
                    <Clock className="w-3 h-3" /> S'entraîner maintenant
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* My Attestations List */}
          <Card className="p-8 rounded-card border border-line shadow-soft bg-white">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-extrabold text-ink tracking-tight">
                Mes Documents Officiels
              </h3>
              <Link href="/attestations">
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-bold text-ocean-strong"
                >
                  Tout voir
                </Button>
              </Link>
            </div>

            <div className="space-y-4">
              {!attestationsData?.attestations?.length ? (
                <div className="p-12 text-center bg-surface-muted rounded-card border border-dashed border-line">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-ink-muted font-bold">
                    Aucune attestation disponible pour le moment.
                  </p>
                </div>
              ) : (
                attestationsData.attestations.map((att: Attestation) => (
                  <div
                    key={att.id}
                    className="p-5 bg-surface-muted rounded-card group hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-action bg-white shadow-sm flex items-center justify-center font-extrabold text-ocean-strong">
                          {att.type.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-ink text-sm">
                            {att.fullName}
                          </p>
                          <p className="text-[10px] text-ink-muted font-bold uppercase tracking-widest">
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
                            className="rounded-pill bg-surface-muted text-slate-300 cursor-not-allowed"
                          >
                            <Download className="w-5 h-5" />
                          </Button>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant="outline"
                              className={`text-[9px] flex items-center gap-1 rounded-pill ${
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
                            <span className="text-[8px] text-ink-muted font-bold uppercase tracking-widest text-right">
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
                      <div className="mt-4 pt-4 border-t border-line flex flex-col gap-3">
                        <div className="flex items-center justify-between text-[10px] font-extrabold text-ink-muted uppercase tracking-widest">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" /> État du
                            Parcours FSA
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                (att.certificationScore || 0) >= 60
                                  ? "text-ocean"
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
                                  ? "text-emerald-500"
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
                              "p-2.5 rounded-action border flex items-center justify-between transition-all",
                              (att.certificationScore || 0) >= 60
                                ? "bg-blue-50 border-blue-100"
                                : "bg-white border-line opacity-60",
                            )}
                          >
                            <span className="text-[9px] font-bold text-ink-muted uppercase">
                              Théorie
                            </span>
                            <span className="text-sm font-extrabold text-ocean-strong">
                              {((att.certificationScore || 0) / 5).toFixed(2)}
                              /20
                            </span>
                          </div>

                          {(att.certificationScore || 0) >= 60 ? (
                            (att.stageScore || 0) > 0 ? (
                              <div className="bg-emerald-50 p-2.5 rounded-action border border-emerald-100 flex items-center justify-between">
                                <span className="text-[9px] font-bold text-emerald-600 uppercase">
                                  Stage
                                </span>
                                <span className="text-sm font-extrabold text-emerald-700">
                                  {((att.stageScore || 0) / 5).toFixed(2)}/20
                                </span>
                              </div>
                            ) : (
                              <Link
                                href="/internships"
                                className="bg-gradient-to-r from-brand to-teal-600 p-2.5 rounded-action text-white flex items-center justify-center gap-2 hover:from-brand-strong hover:to-teal-700 transition-all shadow-soft active:scale-95"
                              >
                                <span className="text-[9px] font-extrabold uppercase">
                                  Postuler au Stage
                                </span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            )
                          ) : (
                            <div className="bg-surface-muted p-2.5 rounded-action border border-line flex items-center justify-center opacity-40">
                              <span className="text-[9px] font-bold text-ink-muted italic">
                                Stage (Bloqué)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {att.status === "REJECTED" && (
                      <div className="mt-4 p-4 rounded-action bg-rose-50 border border-rose-100 flex items-center gap-3">
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
          <Card className="p-6 rounded-card border border-line shadow-soft bg-white">
            <h3 className="text-sm font-extrabold text-ink-muted uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-ocean" />
              Taux de Réussite
            </h3>
            <div className="flex flex-col items-center justify-center py-4">
              <div className="text-5xl font-extrabold text-ink tracking-tight">
                {statsData?.overview?.totalExams
                  ? Math.round(
                      ((statsData?.overview?.examsPassed || 0) /
                        statsData.overview.totalExams) *
                        100,
                    )
                  : 0}
                %
              </div>
              <p className="text-sm font-medium text-ink-muted mt-2">
                Sur {statsData?.overview?.totalExams || 0} examens officiels
              </p>
            </div>
          </Card>

          {/* Recent Submissions (New) */}
          <Card className="p-6 rounded-card border border-line shadow-soft bg-white">
            <h3 className="text-sm font-extrabold text-ink-muted uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> Vos Dernières
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
                      className="group flex items-center justify-between p-4 bg-surface-muted hover:bg-white rounded-card transition-all border border-transparent hover:border-line hover:shadow-lifted"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-action flex items-center justify-center shadow-sm flex-shrink-0 transition-transform group-hover:scale-110",
                            isPassed
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-rose-100 text-rose-600",
                          )}
                        >
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[11px] font-extrabold text-ink truncate uppercase tracking-tight"
                            title={ex.examName}
                          >
                            {ex.examName || "Examen"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="w-3 h-3 text-ink-muted" />
                            <p className="text-[9px] text-ink-muted font-bold uppercase tracking-widest">
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
                            "text-lg font-extrabold leading-none",
                            isPassed ? "text-emerald-600" : "text-rose-600",
                          )}
                        >
                          {scoreOn20.toFixed(1)}/20
                        </div>
                        <Badge
                          className={cn(
                            "text-[8px] h-4 leading-none font-extrabold uppercase tracking-tighter shadow-sm border-none rounded-pill",
                            isGraded
                              ? isPassed
                                ? "bg-emerald-500 text-white"
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
                <div className="py-10 text-center bg-surface-muted/50 rounded-card border border-dashed border-line">
                  <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[10px] text-ink-muted font-bold uppercase tracking-widest italic">
                    Aucun examen passé
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Portfolio Public Preview (New) */}
          {(statsData?.portfolio?.completedMissions || 0) > 0 && (
            <Card className="p-6 rounded-card bg-gradient-to-br from-ocean-strong to-brand-strong text-white border-none shadow-lifted relative overflow-hidden">
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <h4 className="text-xs font-extrabold uppercase tracking-[0.2em] mb-3">
                Votre Vitrine est active
              </h4>
              <p className="text-[11px] text-blue-50/85 mb-4 leading-relaxed font-medium">
                Partagez votre portfolio officiel avec des recruteurs pour
                booster votre carrière.
              </p>
              <Link href={`/p/${user?.email?.split("@")[0] || "anonymous"}`}>
                <Button className="w-full bg-white text-ocean-strong hover:bg-blue-50 font-extrabold text-[10px] uppercase h-10 rounded-action shadow-soft border-none">
                  Voir mon site public
                </Button>
              </Link>
            </Card>
          )}

          {/* Profile Card */}
          <Card className="p-8 rounded-card border border-line shadow-soft bg-white space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-pill bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center text-emerald-700 font-extrabold">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-ink truncate tracking-tight">
                  {user?.name || "Utilisateur"}
                </p>
                <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <Link href="/exams">
                <Button className="w-full bg-ink hover:bg-slate-800 rounded-action h-12 font-bold gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Session
                  Officielle
                </Button>
              </Link>
              <Link href="/exams">
                <Button
                  variant="outline"
                  className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 rounded-action h-12 font-bold gap-2"
                >
                  <GraduationCap className="w-4 h-4" /> Examen Blanc
                </Button>
              </Link>
              <Link href="/profile">
                <Button
                  variant="ghost"
                  className="w-full rounded-action h-10 font-bold text-ink-muted hover:text-ink"
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
