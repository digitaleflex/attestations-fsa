"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  Users,
  GraduationCap,
  AlertCircle,
  Calendar,
  Plus,
  Download,
  UserPlus,
  Eye,
  MoreHorizontal,
  ArrowUpRight,
  Award,
  Bell,
  Search,
  Activity,
  Layers,
  ShieldCheck,
  ClipboardCheck,
  Trophy
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { User, Attestation } from "@/types";

interface DashboardStats {
  total: number;
  validated: number;
}

interface UserSummary {
  total: number;
  newThisMonth: number;
  admins: number;
  candidates: number;
}

interface V4Stats {
  labels: string[];
  series: {
    registrations: number[];
    attestations: number[];
  };
  distribution: Array<{ type: string; count: number }>;
  targets: {
    inscriptions: number;
    attestations: number;
    validations: number;
  };
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AdminDashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Fetch statistics (Global)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiFetch<DashboardStats>("/api/public/stats"),
    staleTime: 2 * 60 * 1000,
  });

  // 2. Fetch users stats
  const { data: usersStats } = useQuery({
    queryKey: ["users-stats"],
    queryFn: async () => {
      const users = await apiFetch<User[]>("/api/users");
      const now = new Date();
      return {
        total: users.length,
        newThisMonth: users.filter((u: User) => {
          const date = new Date(u.createdAt);
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length,
        admins: users.filter((u: User) => u.role === "admin").length,
        candidates: users.filter((u: User) => u.role === "user").length,
      } as UserSummary;
    },
    staleTime: 5 * 60 * 1000,
  });

  // 3. Fetch Dash V4 Stats (Monthly & Targets)
  const { data: v4Stats, isLoading: v4Loading } = useQuery({
    queryKey: ["v4-stats"],
    queryFn: () => apiFetch<V4Stats>("/api/admin/dashboard/stats"),
    staleTime: 5 * 60 * 1000,
  });

  // 4. Fetch recent attestations
  const { data: recentAttestations } = useQuery({
    queryKey: ["recent-attestations"],
    queryFn: async () => {
      const data = await apiFetch<Attestation[] | { attestations: Attestation[] }>("/api/attestations?limit=5");
      return Array.isArray(data) ? data : data.attestations || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // 5. Fetch signalements non traités
  const { data: newReports } = useQuery({
    queryKey: ["new-reports-count"],
    queryFn: async () => {
      const reports = await apiFetch<Array<{ status: string }>>("/api/signalement");
      return Array.isArray(reports) ? reports.filter((r) => r.status === "NOUVEAU").length : 0;
    },
    staleTime: 2 * 60 * 1000,
  });

  // 6. Fetch pending portfolios
  const { data: pendingPortfoliosCount } = useQuery({
    queryKey: ["pending-portfolios-count"],
    queryFn: async () => {
      const users = await apiFetch<User[]>("/api/users");
      return Array.isArray(users) ? users.filter((u: User) => u.portfolioStatus === "PENDING_VALIDATION").length : 0;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Chart Data: Monthly Activity
  const lineData = {
    labels: v4Stats?.labels || [],
    datasets: [
      {
        label: 'Inscriptions',
        data: v4Stats?.series?.registrations || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Attestations',
        data: v4Stats?.series?.attestations || [],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  // Chart Data: Distribution by Type
  const donutData = {
    labels: v4Stats?.distribution?.map((d: { type: string }) => d.type) || ['FORMATION', 'STAGE', 'CERTIFICATION'],
    datasets: [{
      data: v4Stats?.distribution?.map((d: { count: number }) => d.count) || [0, 0, 0],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(245, 158, 11, 0.8)'
      ],
      borderWidth: 0,
      hoverOffset: 10
    }]
  };

  // Chart Data: Performance vs Target
  const barData = {
    labels: ['Inscriptions', 'Attestations', 'Examens Validés'],
    datasets: [
      {
        label: 'Actuel',
        data: [
            usersStats?.newThisMonth || 0,
            stats?.total || 0,
            stats?.validated || 0
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderRadius: 8
      },
      {
        label: 'Objectif',
        data: [
            v4Stats?.targets?.inscriptions || 100,
            v4Stats?.targets?.attestations || 50,
            v4Stats?.targets?.validations || 40
        ],
        backgroundColor: 'rgba(226, 232, 240, 0.8)',
        borderRadius: 8
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B',
        padding: 12,
        borderRadius: 12,
        titleFont: { size: 14, weight: 'bold' as const }
      }
    },
    scales: {
      y: { grid: { display: false }, ticks: { display: false } },
      x: { grid: { display: false } }
    }
  };

  return (
    <div className="p-8 space-y-10 bg-slate-50 min-h-screen animate-in fade-in duration-700">

      {/* Header Premium */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-blue-100 text-blue-700 border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">Dashboard V4</Badge>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Live Monitor</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            Tableau de Bord
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Performance de {mounted ? new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : "--"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl shadow-premium" suppressHydrationWarning>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-48 xl:w-64 border-none bg-slate-50 rounded-xl h-12 focus-visible:ring-blue-500"
            />
          </div>
          <div className="h-8 w-px bg-slate-100 mx-2 hidden sm:block" />
          <Button variant="ghost" size="icon" className="relative rounded-xl h-12 w-12 hover:bg-slate-50">
            <Bell className="w-5 h-5 text-slate-500" />
            {(newReports ?? 0) > 0 && <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">{newReports}</span>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl h-12 w-12 hover:bg-slate-50">
                <MoreHorizontal className="w-5 h-5 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="p-2 rounded-xl">
              <DropdownMenuItem className="rounded-lg">Exporter PDF</DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg">Exporter Excel</DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg text-rose-600">Réinitialiser vues</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 px-6 gap-2 shadow-lg shadow-slate-200 ml-auto xl:ml-0">
             <Plus className="w-4 h-4" /> Nouvelle entrée
          </Button>
        </div>
      </div>

      {/* Quick Access / Security */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/admin/logs">
            <Card className="p-4 border-none shadow-premium bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-white/50">Sécurité</p>
                    <p className="text-sm font-bold">Journal d'Audit</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-white transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </Card>
          </Link>
          
          <Link href="/admin/portfolios">
            <Card className="p-4 border-none shadow-premium bg-white hover:bg-slate-50 transition-all cursor-pointer group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Certification</p>
                    <p className="text-sm font-bold text-slate-900">Validation Portfolios</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {(pendingPortfoliosCount || 0) > 0 && <Badge className="bg-rose-500 text-white border-none text-[8px] px-1.5 h-4 flex items-center justify-center">{pendingPortfoliosCount}</Badge>}
                   <ArrowUpRight className="w-4 h-4 text-slate-200 group-hover:text-purple-600 transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </div>
              </div>
            </Card>
          </Link>
          
          <Link href="/admin/submissions">
            <Card className="p-4 border-none shadow-premium bg-white hover:bg-slate-50 transition-all cursor-pointer group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Pédagogique</p>
                    <p className="text-sm font-bold text-slate-900">Correction des Copies</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-200 group-hover:text-emerald-600 transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </Card>
          </Link>
      </div>

      {/* Main Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Inscriptions", val: usersStats?.total || 0, icon: UserPlus, color: "bg-blue-500", shadow: "shadow-blue-200" },
          { title: "Portfolios", val: pendingPortfoliosCount || 0, icon: Trophy, color: "bg-purple-500", shadow: "shadow-purple-200" },
          { title: "Validations", val: stats?.validated || 0, icon: CheckCircle, color: "bg-amber-500", shadow: "shadow-amber-200" },
          { title: "Signalements", val: newReports || 0, icon: AlertCircle, color: "bg-rose-500", shadow: "shadow-rose-200" },
        ].map((stat) => (
          <Card key={stat.title} className="p-8 border-none shadow-premium bg-white hover:translate-y-[-4px] transition-all duration-300 group overflow-hidden relative">
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.color} opacity-5 rounded-bl-full transition-all group-hover:scale-150`} />
            <div className="flex items-start justify-between relative z-10">
              <div className={`w-14 h-14 rounded-2xl ${stat.color} flex items-center justify-center shadow-lg ${stat.shadow}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <ArrowUpRight className="text-slate-200 w-6 h-6" />
            </div>
            <div className="mt-8 relative z-10">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.title}</p>
              <p className="text-4xl font-black mt-2 text-slate-900 flex items-center gap-1">
                {v4Loading || statsLoading ? <Loader2 className="animate-spin w-8 h-8 text-slate-200" /> : stat.val.toLocaleString('fr-FR')}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Dynamic Activity Chart */}
        <Card className="xl:col-span-2 p-8 border-none shadow-premium bg-white flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div>
                   <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                       <Activity className="w-5 h-5 text-blue-500" />
                       Activité Mensuelle
                   </h2>
                   <p className="text-sm text-slate-400 font-medium italic">Progression visuelle des inscriptions vs attestations</p>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-[10px] font-black uppercase text-slate-400">Inscrits</span></div>
                   <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-[10px] font-black uppercase text-slate-400">Attestations</span></div>
                </div>
            </div>
            <div className="h-80 w-full">
                {v4Loading ? <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed"><Loader2 className="animate-spin text-slate-300" /></div> : (
                    <Line data={lineData} options={chartOptions} />
                )}
            </div>
        </Card>

        {/* Global Distribution */}
        <Card className="p-8 border-none shadow-premium bg-white h-full">
             <h2 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-2">
                 <Layers className="w-5 h-5 text-orange-500" />
                 Types d'Attestations
             </h2>
             <div className="h-64 relative flex items-center justify-center">
                {v4Loading ? <Loader2 className="animate-spin text-slate-300" /> : <Doughnut data={donutData} options={{ ...chartOptions, cutout: '75%' }} />}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-3xl font-black text-slate-900">{(stats as DashboardStats)?.total || 0}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                </div>
             </div>
             <div className="mt-8 space-y-4">
                 {(v4Stats as V4Stats)?.distribution?.map((d: { type: string; count: number }, i: number) => (
                     <div key={d.type} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all cursor-default">
                         <div className="flex items-center gap-3">
                             <div className={`w-3 h-3 rounded-full ${['bg-blue-500', 'bg-purple-500', 'bg-amber-500'][i]}`} />
                             <span className="text-xs font-bold text-slate-600 uppercase">{d.type}</span>
                         </div>
                         <span className="text-sm font-black text-slate-900">{d.count}</span>
                     </div>
                 ))}
             </div>
        </Card>
      </div>

      {/* Targets & Recent Records Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

         {/* Performance Bar Chart */}
         <Card className="p-8 border-none shadow-premium bg-white">
             <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tighter">
                    💪 Progression vs Objectifs
                </h2>
                <Badge variant="outline" className="bg-slate-50">Temps Réel</Badge>
             </div>
             <div className="h-64">
                <Bar data={barData} options={chartOptions} />
             </div>
         </Card>

         {/* Recent Attestations with Detail View */}
         <Card className="p-8 border-none shadow-premium bg-white">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-900 tracking-tighter">📜 Flux des Attestations</h2>
                <Link href="/admin/attestations">
                    <Button variant="ghost" className="text-blue-600 font-bold hover:bg-blue-50 rounded-lg">Voir Tout</Button>
                </Link>
            </div>
            <div className="space-y-4">
                {recentAttestations?.map((a: Attestation) => (
                    <div key={a.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100 group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-blue-600">
                                {a.fullName.charAt(0)}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{a.fullName}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{a.formation?.name || "Stage"} • {new Date(a.issuedAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Badge className={`${a.status === 'VALIDATED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-none px-3 font-bold`}>{a.status}</Badge>
                            <Link href={`/admin/attestations/${a.id}`}>
                                <Button size="icon" variant="ghost" className="rounded-full hover:bg-slate-200 transition-transform group-hover:scale-110">
                                    <ArrowUpRight className="w-4 h-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
         </Card>
      </div>

    </div>
  );
}
