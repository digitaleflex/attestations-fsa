"use client";

export const dynamic = 'force-dynamic';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Download, Clock, CheckCircle, Award, LogOut, User as UserIcon, Calendar, Mail, TrendingUp, BookOpen, Briefcase, Search, Link as LinkIcon, Activity, Trophy, GraduationCap, ArrowRight, ShieldCheck, ShieldAlert, Megaphone, Loader2 as LoaderIcon, Play, Rocket, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynImport from "next/dynamic";
import CertificateTemplate from "@/components/CertificateTemplate";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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
  recentExams: Array<{
    id: string;
    totalScore: number;
    status: string;
    submittedAt: string;
    exam: {
      title: string;
      totalPoints: number;
    };
  }>;
}

// Import dynamique pour éviter SSR
const html2pdf = dynImport(() => import("html2pdf.js"), { ssr: false });

export default function UserDashboardPage() {
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  // Fetch settings for branding
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch("/api/public/settings");
      if (!res.ok) return null;
      return res.json();
    }
  });

  const handleClaimCode = async () => {
    if (!claimCode || claimCode.length < 5) {
      toast.error("Veuillez entrer au moins les 5 derniers caractères de votre code.");
      return;
    }

    setIsClaiming(true);
    try {
      const response = await fetch("/api/user/claim-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codePart: claimCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Erreur lors de la liaison du code");
      }

      toast.success("Succès ! Votre dossier a été lié et votre profil a été mis à jour.");
      // On rafraîchit les data query au lieu de recharger toute la page si possible
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de liaison";
      toast.error(message);
    } finally {
      setIsClaiming(false);
    }
  };

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

  // Fetch user profile
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        if (res.status === 401) router.push("/auth");
        throw new Error("Non autorisé");
      }
      return res.json() as Promise<User & { correctionRequests: any[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch data
  const { data: attestationsData } = useQuery({
    queryKey: ["user-attestations"],
    queryFn: async () => {
      const res = await fetch("/api/user/attestations?limit=5");
      return res.json() as Promise<{ attestations: Attestation[] }>;
    }
  });

  const { data: examsData } = useQuery({
    queryKey: ["user-exams"],
    queryFn: async () => {
      const res = await fetch("/api/user/exams");
      return res.json();
    }
  });

  const { data: notificationsData, refetch: refetchNotifications } = useQuery({
    queryKey: ["user-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/user/notifications?limit=3");
      return res.json() as Promise<{ notifications: Notification[], unreadCount: number }>;
    }
  });

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id })
      });
      refetchNotifications();
    } catch {}
  };

  const { data: statsData } = useQuery({
    queryKey: ["user-statistics"],
    queryFn: async () => {
      const res = await fetch("/api/user/statistics");
      return res.json() as Promise<UserStatistics>;
    }
  });

  const handleDownload = async (att: Attestation) => {
    if (att.status === "REJECTED") {
      toast.error("Cette attestation a été révoquée par l'administration.");
      return;
    }
    
    const fileName = `${att.code.slice(-5)}_${att.fullName.replace(/\s+/g, '_')}.pdf`;

    toast.promise(
      (async () => {
        const h2p = (await import("html2pdf.js")).default;
        const element = document.getElementById(`cert-template-dash-${att.id}`);
        if (!element) throw new Error("Template non trouvé");

        const opt = {
          margin: 0,
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        await h2p().set(opt).from(element).save();
      })(),
      {
        loading: 'Génération de votre diplôme officiel...',
        success: 'Téléchargement réussi !',
        error: 'Erreur de génération',
      }
    );
  };

  const chartData = {
    labels: ['Examens Officiels', 'Réussites', 'En cours'],
    datasets: [{
      label: 'Ma Progression',
      data: [
        statsData?.overview?.totalExams || 0,
        statsData?.overview?.examsPassed || 0,
        (statsData?.overview?.totalExams || 0) - (statsData?.overview?.examsPassed || 0)
      ],
      backgroundColor: [
        'rgba(59, 130, 246, 0.2)',
        'rgba(16, 185, 129, 0.7)',
        'rgba(245, 158, 11, 0.2)'
      ],
      borderColor: [
        'rgb(59, 130, 246)',
        'rgb(16, 185, 129)',
        'rgb(245, 158, 11)'
      ],
      borderWidth: 1,
      borderRadius: 12
    }]
  };

  if (userLoading) return (
    <div className="min-h-screen flex items-center justify-center grayscale">
        <LoaderIcon className="animate-spin text-slate-300 w-8 h-8" />
    </div>
  );

  const hasPendingCorrection = (user?.correctionRequests?.length || 0) > 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Welcome Premium */}
        <Card className="p-8 bg-gradient-to-br from-slate-900 to-blue-900 text-white shadow-2xl relative overflow-hidden group border-none">
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-1000" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-none px-3 py-1 text-[10px] uppercase font-black tracking-widest mb-2">Espace Candidat</Badge>
              <h2 className="text-4xl font-black tracking-tighter">Bienvenue, {user?.name?.split(' ')[0] || 'Candidat'} ! 👋</h2>
              <p className="text-blue-100/70 font-medium">
                Votre parcours continue. Retrouvez vos succès et vos prochaines étapes ici.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                <Trophy className="w-10 h-10 text-amber-400" />
              </div>
            </div>
          </div>
        </Card>

        {/* Portfolio Journey (New) */}
        <Card className="p-6 border-none shadow-premium bg-white relative overflow-hidden">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                    <Rocket className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="font-black text-slate-900 tracking-tight">VOTRE PARCOURS PROFESSIONNEL</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Missions validées : {statsData?.portfolio?.completedMissions || 0} / {statsData?.portfolio?.totalMissions || 0}
                    </p>
                 </div>
              </div>
              
              {/* Badge Display */}
              {(statsData?.portfolio?.completedMissions || 0) > 0 && (
                <div className={cn(
                  "px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm border animate-in zoom-in duration-500",
                  (statsData?.portfolio?.completedMissions || 0) >= 6 ? "bg-amber-400 border-amber-500 text-amber-950" :
                  (statsData?.portfolio?.completedMissions || 0) >= 3 ? "bg-slate-200 border-slate-300 text-slate-800" :
                  "bg-orange-200 border-orange-300 text-orange-950"
                )}>
                   <Trophy className="w-4 h-4" />
                   <span className="text-[10px] font-black uppercase">
                     { (statsData?.portfolio?.completedMissions || 0) >= 6 ? "Rang Or" :
                      (statsData?.portfolio?.completedMissions || 0) >= 3 ? "Rang Argent" :
                      "Rang Bronze"}
                   </span>
                </div>
              )}

              <div className="flex-1 max-w-md w-full">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-indigo-600">PROGRESSION</span>
                    <span className="text-[10px] font-black text-indigo-600">
                      {statsData?.portfolio?.totalMissions ? Math.round(((statsData?.portfolio?.completedMissions || 0) / statsData.portfolio.totalMissions) * 100) : 0}%
                    </span>
                 </div>
                 <div className="h-2 bg-indigo-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-1000" 
                      style={{ width: `${statsData?.portfolio?.totalMissions ? Math.round(((statsData?.portfolio?.completedMissions || 0) / statsData.portfolio.totalMissions) * 100) : 0}%` }} 
                    />
                 </div>
              </div>
              <Link href="/portfolio">
                 <Button className="bg-indigo-600 hover:bg-indigo-700 h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-wider">
                    Continuer mes missions
                 </Button>
              </Link>
           </div>
        </Card>
        
        {/* Section Relevé de Notes Prompt (New) */}
        {(statsData?.overview?.totalExams || 0) > 0 && (
          <Card className="p-6 border-none shadow-premium bg-gradient-to-r from-blue-700 to-indigo-800 text-white relative overflow-hidden group animate-in slide-in-from-right duration-700">
             <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-1000" />
             <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white shadow-sm shrink-0 backdrop-blur-md border border-white/10">
                      <FileText className="w-7 h-7" />
                   </div>
                   <div>
                      <h3 className="font-black text-white tracking-tight text-lg mb-1 uppercase">Votre relevé de notes est prêt ! 📜</h3>
                      <p className="text-blue-100/80 text-sm font-medium max-w-xl">
                        Votre parcours académique a été validé. Vous pouvez dès maintenant télécharger votre relevé de notes officiel certifié par la direction.
                      </p>
                   </div>
                </div>
                <Link href="/transcript?download=true">
                   <Button className="bg-white text-blue-700 hover:bg-blue-50 h-12 px-8 rounded-xl font-black text-sm uppercase tracking-wider shadow-2xl flex items-center gap-2 group/btn">
                      Télécharger le relevé officiel
                      <Download className="w-4 h-4 group-hover/btn:translate-y-1 transition-transform" />
                   </Button>
                </Link>
             </div>
          </Card>
        )}

        {/* 📢 Nouvelles de la Direction */}
        {notificationsData?.notifications && notificationsData.notifications.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-rose-500" /> Annonces de la Direction
              </h3>
              {(notificationsData?.unreadCount || 0) > 0 && (
                <Badge className="bg-rose-500 text-white border-none animate-pulse">
                  {notificationsData?.unreadCount} nouvelle(s)
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notificationsData.notifications.filter((n: Notification) => !n.isRead).map((notif: Notification) => (
                <Card key={notif.id} className="p-5 border-none shadow-premium relative overflow-hidden transition-all bg-white border-l-4 border-l-rose-500 group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 text-sm">{notif.title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{notif.message}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">
                        Posté le {new Date(notif.createdAt).toLocaleDateString()}
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
        <Card className={`p-8 border-none shadow-premium relative overflow-hidden transition-all duration-500 ${
            hasPendingCorrection ? 'bg-slate-100 grayscale-[0.3]' : 'bg-white'
        }`}>
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <UserIcon size={120} />
          </div>
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className={`flex-1 space-y-4 ${hasPendingCorrection ? 'opacity-60' : ''}`}>
                 <div className="flex items-center gap-2">
                    <Badge className={`${
                        hasPendingCorrection ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    } border-none px-2 py-0.5 text-[9px] uppercase font-bold`}>
                        {hasPendingCorrection ? 'Demande en cours' : 'Étape Importante'}
                    </Badge>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                        {hasPendingCorrection ? 'Traitement de vos informations' : 'Vérifiez vos informations officielles'}
                    </h3>
                 </div>
                 <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
                   {hasPendingCorrection
                     ? "Une demande de modification est actuellement entre les mains de nos administrateurs. Vos documents seront mis à jour dès validation."
                     : "Avant que nous n'émettions vos documents officiels, assurez-vous que votre nom, date et lieu de naissance sont corrects. Ces informations apparaîtront telles quelles sur vos diplômes."
                   }
                 </p>

                 <div className="flex flex-wrap gap-4 py-2">
                    <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Nom complet</span>
                        <span className="font-bold text-slate-800">{user?.name || "Non défini"}</span>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Date de naissance</span>
                        <span className="font-bold text-slate-800">{user?.birthDate ? new Date(user.birthDate).toLocaleDateString() : "--/--/----"}</span>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Lieu de naissance</span>
                        <span className="font-bold text-slate-800">{user?.birthPlace || "Non défini"}</span>
                    </div>
                    <div className={`px-4 py-2 rounded-xl border text-xs transition-all ${
                        user?.emailVerified
                            ? "bg-emerald-50 border-emerald-100"
                            : "bg-amber-50 border-amber-100 animate-pulse"
                    }`}>
                        <span className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Email vérifié</span>
                        <div className="flex items-center gap-1.5">
                            {user?.emailVerified ? (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span className={`font-black ${user?.emailVerified ? "text-emerald-700" : "text-amber-700"}`}>
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
                          <Button className="bg-blue-600 hover:bg-blue-700 h-11 px-6 rounded-xl font-bold shadow-lg shadow-blue-100">
                              Vérifier et Valider
                          </Button>
                        </Link>
                        <Link href="/support">
                          <Button variant="outline" className="h-11 px-6 rounded-xl font-bold border-slate-200">
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
                            {isSendingVerification ? "Envoi..." : "Vérifier mon email"}
                          </Button>
                        )}
                     </>
                   )}
                 </div>
              </div>
          </div>
        </Card>

        {/* Dossier Linking Section (Refined) */}
        <Card className={`p-8 border-none shadow-premium relative overflow-hidden transition-all duration-500 ${
            (attestationsData?.attestations?.length || 0) > 0 ? "bg-emerald-50/50" : "bg-emerald-50"
        }`}>
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                            (attestationsData?.attestations?.length || 0) > 0 ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-600"
                        }`}>
                            {(attestationsData?.attestations?.length || 0) > 0 ? <CheckCircle className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
                        </div>
                        <h3 className={`text-xl font-black tracking-tight ${
                            (attestationsData?.attestations?.length || 0) > 0 ? "text-emerald-800" : "text-emerald-900"
                        }`}>
                            {(attestationsData?.attestations?.length || 0) > 0 ? "Félicitations ! Votre dossier est lié." : "Récupérer mon dossier FSA"}
                        </h3>
                    </div>

                    {(attestationsData?.attestations?.length || 0) > 0 ? (
                        <div className="space-y-3">
                            <p className="text-emerald-700/80 text-sm font-medium">
                                Vos informations officielles ont été synchronisées avec succès. Vous pouvez maintenant télécharger vos documents ci-dessous.
                            </p>
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-100/50 w-fit px-3 py-1.5 rounded-full">
                                <ShieldCheck className="w-4 h-4" /> COMPTE CERTIFIÉ
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-emerald-700/80 text-sm font-medium">
                                Saisissez les 5 derniers caractères de la séquence de votre code d&apos;attestation pour lier votre dossier.
                            </p>
                            <div className="flex gap-2 max-w-md">
                                <Input
                                    placeholder="Ex: 2ee8f"
                                    className="bg-white border-emerald-200 h-12 rounded-xl font-mono focus-visible:ring-emerald-500 text-lg lowercase"
                                    value={claimCode}
                                    onChange={(e) => setClaimCode(e.target.value.toLowerCase())}
                                    maxLength={30}
                                />
                                <Button onClick={handleClaimCode} className="h-12 bg-emerald-700 hover:bg-emerald-800 rounded-xl px-8 font-black shadow-lg shadow-emerald-700/20" disabled={isClaiming}>
                                    {isClaiming ? <LoaderIcon className="w-5 h-5 animate-spin" /> : "LIER"}
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                <div className={`hidden lg:block w-32 h-32 transition-transform duration-700 ${(attestationsData?.attestations?.length || 0) > 0 ? "scale-110 rotate-12" : "opacity-20"}`}>
                    <Award className={`w-full h-full ${(attestationsData?.attestations?.length || 0) > 0 ? "text-emerald-500" : "text-emerald-900"}`} />
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
                       { label: "Attestations", val: statsData?.overview?.totalAttestations || 0, icon: FileText, bg: "bg-blue-600" },
                       { label: "Réussites Off.", val: statsData?.overview?.examsPassed || 0, icon: CheckCircle, bg: "bg-emerald-600" },
                       { label: "Examen Blanc", val: statsData?.overview?.totalMockExams || 0, icon: GraduationCap, bg: "bg-indigo-500" },
                       { label: "Score Moyen", val: (statsData?.overview?.averageScore || 0) + "%", icon: TrendingUp, bg: "bg-amber-500" },
                   ].map(s => (
                       <Card key={s.label} className="p-4 border-none shadow-premium bg-white flex items-center gap-3 hover:shadow-lg transition-all group overflow-hidden relative">
                           <div className={`absolute top-0 right-0 w-12 h-12 ${s.bg} opacity-[0.03] rounded-bl-full group-hover:scale-[3] transition-transform duration-700`} />
                           <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
                               <s.icon className="w-5 h-5" />
                           </div>
                           <div className="min-w-0">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{s.label}</p>
                               <p className="text-xl font-black text-slate-900 truncate">{s.val}</p>
                           </div>
                       </Card>
                   ))}
                </div>

                {/* Exams Status Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Official Exam Status */}
                    <Card className="p-6 border-none shadow-premium bg-white group hover:shadow-xl transition-all border-l-4 border-l-blue-600">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-blue-600" /> Session Officielle
                            </h3>
                            <Link href="/exams">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold">Détails</Button>
                            </Link>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase">Examens officiels</span>
                                <span className="text-sm font-black text-slate-900">{statsData?.overview?.totalExams || 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase">Réussites</span>
                                <span className="text-sm font-black text-emerald-600">{statsData?.overview?.examsPassed || 0}</span>
                            </div>
                            <Link href="/exams" className="block pt-2">
                                <Button className="w-full bg-slate-900 hover:bg-black h-10 rounded-xl text-[10px] font-black uppercase tracking-wider gap-2">
                                    <Play className="w-3 h-3" /> Accéder à la session
                                </Button>
                            </Link>
                        </div>
                    </Card>

                    {/* Mock Exam Status */}
                    <Card className="p-6 border-none shadow-premium bg-white group hover:shadow-xl transition-all border-l-4 border-l-indigo-600">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-indigo-600" /> Auto-Évaluation
                            </h3>
                            <Link href="/mock-exams">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold">Détails</Button>
                            </Link>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase">Entraînements</span>
                                <span className="text-sm font-black text-slate-900">{statsData?.overview?.totalMockExams || 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase">Objectif atteint</span>
                                <span className="text-sm font-black text-indigo-600">{statsData?.overview?.mockExamsPassed || 0}</span>
                            </div>
                            <Link href="/mock-exams" className="block pt-2">
                                <Button variant="outline" className="w-full border-indigo-100 text-indigo-600 hover:bg-indigo-50 h-10 rounded-xl text-[10px] font-black uppercase tracking-wider gap-2">
                                    <Clock className="w-3 h-3" /> S'entraîner maintenant
                                </Button>
                            </Link>
                        </div>
                    </Card>
                </div>

                {/* My Attestations List */}
                <Card className="p-8 border-none shadow-premium bg-white">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-slate-900 tracking-tighter">Mes Documents Officiels</h3>
                        <Link href="/attestations">
                            <Button variant="ghost" size="sm" className="font-bold text-blue-600">Tout voir</Button>
                        </Link>
                    </div>

                    <div className="space-y-4">
                        {!attestationsData?.attestations?.length ? (
                             <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-400 font-bold">Aucune attestation disponible pour le moment.</p>
                             </div>
                         ) : (
                                attestationsData.attestations.map((att: Attestation) => (
                                <div key={att.id} className="p-5 bg-slate-50 rounded-2xl group hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-blue-600">
                                                {att.type.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{att.fullName}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                    {att.formation?.name || "Stage"} • {new Date(att.issuedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                         <div className="flex items-center gap-2">
                                             {att.status === 'VALIDATED' && (att.type === 'FORMATION' ? (att.certificationScore || 0) > 0 : ((att.certificationScore || 0) > 0 && (att.stageScore || 0) > 0)) ? (
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
                                                     <Badge variant="outline" className={`text-[9px] flex items-center gap-1 ${
                                                         att.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-100'
                                                     }`}>
                                                         <ShieldAlert className="w-2.5 h-2.5" /> 
                                                         {att.status === 'REJECTED' ? 'ATTESTATION RÉVOQUÉE' : 'SCORES EN ATTENTE'}
                                                     </Badge>
                                                     <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest text-right">
                                                         {att.status === 'REJECTED' ? 'Action administrative requise' : 'Validation en cours...'}
                                                     </span>
                                                 </div>
                                             )}
                                         </div>
                                     </div>
 
                                     {/* Barre de Progression Théorie + Stage */}
                                     {att.status !== "REJECTED" && (
                                     <div className="mt-4 pt-4 border-t border-slate-200/50 flex flex-col gap-3">
                                         <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                             <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> État du Parcours FSA</span>
                                             <div className="flex items-center gap-2">
                                                 <span className={(att.certificationScore || 0) >= 60 ? "text-blue-500" : "text-slate-300"}>Théorie {(att.certificationScore || 0) >= 60 ? "✓" : "○"}</span>
                                                 <span className="text-slate-200">|</span>
                                                 <span className={(att.stageScore || 0) >= 60 ? "text-emerald-500" : "text-slate-300"}>Pratique {(att.stageScore || 0) >= 60 ? "✓" : "○"}</span>
                                             </div>
                                         </div>
                                         <div className="grid grid-cols-2 gap-3">
                                             <div className={cn(
                                                "p-2.5 rounded-xl border flex items-center justify-between transition-all",
                                                (att.certificationScore || 0) >= 60 ? "bg-blue-50 border-blue-100" : "bg-white border-slate-100 opacity-60"
                                             )}>
                                                 <span className="text-[9px] font-bold text-slate-500 uppercase">Théorie</span>
                                                 <span className="text-sm font-black text-blue-700">{( (att.certificationScore || 0) / 5 ).toFixed(2)}/20</span>
                                             </div>
                                             
                                             {(att.certificationScore || 0) >= 60 ? (
                                                 (att.stageScore || 0) > 0 ? (
                                                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between">
                                                        <span className="text-[9px] font-bold text-emerald-600 uppercase">Stage</span>
                                                        <span className="text-sm font-black text-emerald-700">{( (att.stageScore || 0) / 5 ).toFixed(2)}/20</span>
                                                    </div>
                                                 ) : (
                                                    <Link href="/internships"
 className="bg-gradient-to-r from-emerald-600 to-teal-600 p-2.5 rounded-xl text-white flex items-center justify-center gap-2 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg active:scale-95 shadow-emerald-100">
                                                        <span className="text-[9px] font-black uppercase">Postuler au Stage</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                    </Link>
                                                 )
                                             ) : (
                                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-center opacity-40">
                                                     <span className="text-[9px] font-bold text-slate-400 italic">Stage (Bloqué)</span>
                                                </div>
                                             )}
                                         </div>
                                     </div>
                                     )}

                                     {att.status === "REJECTED" && (
                                         <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-3">
                                             <ShieldAlert className="w-5 h-5 text-rose-500" />
                                             <p className="text-[11px] text-rose-600 font-medium leading-tight">
                                                 Cette attestation a été invalidée. Pour toute contestation, merci de contacter le bureau de la Ferme St André.
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

                {/* Progression Mini-Chart */}
                <Card className="p-8 border-none shadow-premium bg-white">
                    <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Mon Avancement
                    </h3>
                    <div className="h-48 flex items-center justify-center">
                        <Bar
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: { x: { grid: { display: false } }, y: { display: false } }
                            }}
                        />
                    </div>
                    <div className="mt-6 flex justify-center">
                        <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">
                            Taux de réussite : {statsData?.overview?.totalExams ? Math.round(((statsData?.overview?.examsPassed || 0) / statsData.overview.totalExams) * 100) : 0}%
                        </Badge>
                    </div>
                </Card>

                {/* Recent Submissions (New) */}
                <Card className="p-6 border-none shadow-premium bg-white">
                   <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-500" /> Vos Dernières Notes
                   </h3>
                    <div className="space-y-3">
                       {statsData?.recentExams && statsData.recentExams.length > 0 ? (
                         statsData.recentExams.map((ex: any) => {
                           const passingThreshold = ex.exam?.passingScore || 65;
                           const scorePercent = ex.exam?.totalPoints > 0 ? (ex.totalScore / ex.exam.totalPoints) * 100 : 0;
                           const scoreOn20 = (scorePercent / 100) * 20;
                           const isPassed = scorePercent >= passingThreshold;
                           
                           return (
                             <div key={ex.id} className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-100 hover:shadow-xl hover:shadow-slate-200/50">
                                <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
                                   <div className={cn(
                                     "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 transition-transform group-hover:scale-110",
                                     isPassed ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                   )}>
                                      <GraduationCap className="w-5 h-5" />
                                   </div>
                                   <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight" title={ex.exam?.title}>
                                        {ex.exam?.title || "Examen"}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Le {new Date(ex.submittedAt).toLocaleDateString()}</p>
                                      </div>
                                   </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1.5">
                                   <div className={cn(
                                     "text-lg font-black leading-none",
                                     isPassed ? "text-emerald-600" : "text-rose-600"
                                   )}>
                                     {scoreOn20.toFixed(1)}/20
                                   </div>
                                   <Badge className={cn(
                                     "text-[8px] h-4 leading-none font-black uppercase tracking-tighter shadow-sm border-none",
                                     ex.status === 'GRADED' || ex.status === 'COMPLETED' 
                                       ? (isPassed ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")
                                       : "bg-amber-100 text-amber-700"
                                   )}>
                                      {ex.status === 'GRADED' || ex.status === 'COMPLETED' ? (isPassed ? 'Admis' : 'Échec') : 'En correction'}
                                   </Badge>
                                </div>
                             </div>
                           )
                         })
                       ) : (
                         <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                           <Activity className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Aucun examen passé</p>
                         </div>
                       )}
                    </div>
                </Card>

                {/* Portfolio Public Preview (New) */}
                {(statsData?.portfolio?.completedMissions || 0) > 0 && (
                   <Card className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none shadow-xl relative overflow-hidden">
                      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-3">Votre Vitrine est active</h4>
                      <p className="text-[11px] text-indigo-100/80 mb-4 leading-relaxed font-medium">
                        Partagez votre portfolio officiel avec des recruteurs pour booster votre carrière.
                      </p>
                      <Link href={`/p/${user?.email?.split('@')[0] || 'anonymous'}`}>
                        <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-black text-[10px] uppercase h-10 rounded-xl shadow-lg border-none">
                           Voir mon site public
                        </Button>
                      </Link>
                   </Card>
                )}

                {/* Profile Card */}
                <Card className="p-8 border-none shadow-premium bg-white space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-black">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                            <p className="font-black text-slate-900 truncate tracking-tight">{user?.name || "Utilisateur"}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{user?.email}</p>
                        </div>
                    </div>
                    <div className="space-y-2 pt-4">
                        <Link href="/exams">
                            <Button className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl h-12 font-bold gap-2">
                                <ShieldCheck className="w-4 h-4 text-amber-400" /> Session Officielle
                            </Button>
                        </Link>
                        <Link href="/mock-exams">
                            <Button variant="outline" className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl h-12 font-bold gap-2">
                                <GraduationCap className="w-4 h-4" /> Examen Blanc
                            </Button>
                        </Link>
                        <Link href="/profile">
                            <Button variant="ghost" className="w-full rounded-xl h-10 font-bold text-slate-500 hover:text-slate-900">
                                Gérer mon profil
                            </Button>
                        </Link>
                    </div>
                </Card>

            </div>
        </div>

        {/* Hidden Templates for PDF Generation */}
        <div className="hidden" aria-hidden="true">
            {attestationsData?.attestations?.filter((a: any) => a.status === "VALIDATED").map((att: any) => (
                <CertificateTemplate
                    key={att.id}
                    id={`cert-template-dash-${att.id}`}
                    settings={settings}
                    data={{
                        fullName: att.fullName,
                        formationName: att.formation?.name || "Formation Professionnelle",
                        code: att.code,
                        issuedAt: att.issuedAt,
                        startDate: att.startDate,
                        endDate: att.endDate,
                        score: att.type === "FORMATION" ? att.certificationScore : att.stageScore,
                        hours: att.type === "FORMATION" ? att.certificationHours : att.stageHours,
                        type: att.type,
                        gender: att.gender,
                        status: att.status
                    }}
                />
            ))}
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
