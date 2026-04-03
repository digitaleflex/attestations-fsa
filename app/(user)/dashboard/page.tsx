"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Download, Clock, CheckCircle, Award, LogOut, User, Calendar, Mail, TrendingUp, BookOpen, Briefcase, Search, Link as LinkIcon, Activity, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
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

// Import dynamique pour éviter SSR
const html2pdf = dynamic(() => import("html2pdf.js"), { ssr: false });

export default function UserDashboardPage() {
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);

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
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsClaiming(false);
    }
  };

  // Fetch user profile
  const { data: user, isLoading: userLoading } = useQuery({
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

  // Fetch data
  const { data: attestationsData } = useQuery({
    queryKey: ["user-attestations"],
    queryFn: async () => {
      const res = await fetch("/api/user/attestations?limit=5");
      return res.json();
    }
  });

  const { data: examsData } = useQuery({
    queryKey: ["user-exams"],
    queryFn: async () => {
      const res = await fetch("/api/user/exams");
      return res.json();
    }
  });

  const { data: statsData } = useQuery({
    queryKey: ["user-statistics"],
    queryFn: async () => {
      const res = await fetch("/api/user/statistics");
      return res.json();
    }
  });

  const handleDownload = async (att: any) => {
    const fileName = `${att.code.slice(-5)}_${att.fullName.replace(/\s+/g, '_')}.pdf`;
    
    toast.promise(
      (async () => {
        const html2pdf = (await import("html2pdf.js")).default;
        const element = document.getElementById(`cert-template-dash-${att.id}`);
        if (!element) throw new Error("Template non trouvé");

        const opt = {
          margin: 0,
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        await html2pdf().set(opt).from(element).save();
      })(),
      {
        loading: 'Génération de votre diplôme officiel...',
        success: 'Téléchargement réussi !',
        error: 'Erreur de génération',
      }
    );
  };

  const chartData = {
    labels: ['Examens', 'Validés', 'En cours'],
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

  if (userLoading) return <div className="min-h-screen flex items-center justify-center grayscale"><Loader2 className="animate-spin text-slate-300" /></div>;

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
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-500">
               <Trophy className="w-10 h-10 text-amber-400" />
            </div>
          </div>
        </Card>

        {/* Claim Section */}
        {(!user?.attestations || user.attestations.length === 0) && (
          <Card className="p-8 border-none shadow-premium bg-emerald-50 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="flex-1 space-y-4">
                   <h3 className="text-xl font-black text-emerald-900 flex items-center gap-2 tracking-tight">
                       <LinkIcon className="w-5 h-5" />
                       Récupérer mon dossier FSA
                   </h3>
                   <p className="text-emerald-700/80 text-sm font-medium">
                     Liez votre historique de formation en entrant les 5 derniers caractères de votre code secret.
                   </p>
                   <div className="flex gap-2">
                      <Input 
                        placeholder="Ex: 3f8b6..." 
                        className="bg-white border-emerald-200 h-12 rounded-xl font-mono focus-visible:ring-emerald-500"
                        value={claimCode}
                        onChange={(e) => setClaimCode(e.target.value)}
                      />
                      <Button onClick={handleClaimCode} className="h-12 bg-emerald-700 hover:bg-emerald-800 rounded-xl px-6 font-bold" disabled={isClaiming}>
                          {isClaiming ? "Vérification..." : "Lier"}
                      </Button>
                   </div>
                </div>
                <div className="hidden lg:block w-32 h-32 opacity-20">
                    <Award className="w-full h-full text-emerald-900" />
                </div>
            </div>
          </Card>
        )}

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Analytic & Records */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   {[
                       { label: "Attestations", val: statsData?.overview?.totalAttestations || 0, icon: FileText, bg: "bg-blue-500" },
                       { label: "Réussites", val: statsData?.overview?.examsPassed || 0, icon: CheckCircle, bg: "bg-emerald-500" },
                       { label: "Examens", val: statsData?.overview?.totalExams || 0, icon: BookOpen, bg: "bg-amber-500" },
                   ].map(s => (
                       <Card key={s.label} className="p-6 border-none shadow-premium bg-white flex items-center gap-4 hover:shadow-lg transition-all">
                           <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center text-white shadow-lg`}>
                               <s.icon className="w-6 h-6" />
                           </div>
                           <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                               <p className="text-2xl font-black text-slate-900">{s.val}</p>
                           </div>
                       </Card>
                   ))}
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
                            attestationsData.attestations.map((att: any) => (
                                <div key={att.id} className="p-5 bg-slate-50 rounded-2xl flex items-center justify-between group hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100">
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
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleDownload(att)}
                                        disabled={att.status !== 'VALIDATED'}
                                        className="rounded-full bg-white shadow-sm hover:scale-110 active:scale-95 transition-all text-emerald-600"
                                    >
                                        <Download className="w-5 h-5" />
                                    </Button>
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
                            Taux de réussite : {statsData?.overview?.totalExams ? Math.round((statsData.overview.examsPassed / statsData.overview.totalExams) * 100) : 0}%
                        </Badge>
                    </div>
                </Card>

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
                                <BookOpen className="w-4 h-4" /> Passer un examen
                            </Button>
                        </Link>
                        <Link href="/profile">
                            <Button variant="outline" className="w-full rounded-xl h-12 font-bold border-slate-200">
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
                        gender: att.gender
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
