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
  TrendingDown,
  Users,
  GraduationCap,
  AlertCircle,
  Calendar,
  Plus,
  Download,
  Mail,
  UserPlus,
  Eye,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Bell,
  Search,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

// === Types ===
type StatCard = {
  title: string;
  value: number;
  previousValue?: number;
  icon: any;
  color: string;
};


type Formation = {
  id: string;
  name: string;
  count: number;
  percentage: number;
};

export default function AdminDashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/public/stats");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch users stats
  const { data: usersStats } = useQuery({
    queryKey: ["users-stats"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return null;
      const users = await res.json();
      return {
        total: users.length,
        newThisMonth: users.filter((u: any) => {
          const date = new Date(u.createdAt);
          const now = new Date();
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length,
        admins: users.filter((u: any) => u.role === "ADMIN").length,
        candidates: users.filter((u: any) => u.role === "USER").length,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recent attestations
  const { data: recentAttestations } = useQuery({
    queryKey: ["recent-attestations"],
    queryFn: async () => {
      const res = await fetch("/api/attestations?limit=10");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch formations
  const { data: formations } = useQuery({
    queryKey: ["formations"],
    queryFn: async () => {
      const res = await fetch("/api/formations");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch attestations by type
  const { data: attestationsByType } = useQuery({
    queryKey: ["attestations-by-type"],
    queryFn: async () => {
      const res = await fetch("/api/attestations");
      if (!res.ok) return { formation: 0, stage: 0, certification: 0 };
      const all = await res.json();
      return {
        formation: all.filter((a: any) => a.type === "FORMATION").length,
        stage: all.filter((a: any) => a.type === "STAGE").length,
        certification: all.filter((a: any) => a.type === "CERTIFICATION").length,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch settings pour les objectifs
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch signalements non traités
  const { data: newReports } = useQuery({
    queryKey: ["new-reports-count"],
    queryFn: async () => {
      const res = await fetch("/api/signalement");
      if (!res.ok) return 0;
      const reports = await res.json();
      return Array.isArray(reports) ? reports.filter((r: any) => r.status === "NOUVEAU").length : 0;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Calculate validation rate
  const validationRate = stats?.total ? Math.round((stats.validated / stats.total) * 100) : 0;
  const pendingRate = stats?.total ? Math.round((stats.pending / stats.total) * 100) : 0;
  const rejectedRate = stats?.total ? Math.round((stats.rejected / stats.total) * 100) : 0;

  // Top formations (données réelles depuis les attestations)
  const topFormations = React.useMemo(() => {
    if (!recentAttestations || !Array.isArray(recentAttestations)) return [];
    // Récupérer toutes les attestations pour compter par formation
    const formationMap = new Map<string, { name: string; count: number }>();
    recentAttestations.forEach((a: any) => {
      const name = a.formation?.name || "Inconnue";
      const existing = formationMap.get(name);
      if (existing) {
        existing.count++;
      } else {
        formationMap.set(name, { name, count: 1 });
      }
    });
    const sorted = Array.from(formationMap.values()).sort((a, b) => b.count - a.count).slice(0, 4);
    const maxCount = sorted[0]?.count || 1;
    return sorted.map((f, i) => ({
      id: String(i),
      name: f.name,
      count: f.count,
      percentage: Math.round((f.count / maxCount) * 100),
    }));
  }, [recentAttestations]);

  // Stat cards data (sans tendances inventées)
  const statCards: StatCard[] = [
    {
      title: "Total Attestations",
      value: stats?.total || 0,
      icon: FileText,
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "Validées",
      value: stats?.validated || 0,
      icon: CheckCircle,
      color: "from-emerald-500 to-emerald-600",
    },
    {
      title: "En attente",
      value: stats?.pending || 0,
      icon: Clock,
      color: "from-amber-500 to-amber-600",
    },
    {
      title: "Refusées",
      value: stats?.rejected || 0,
      icon: XCircle,
      color: "from-rose-500 to-rose-600",
    },
  ];

  // Objectifs du mois (depuis les paramètres)
  const objectives = [
    { label: "Inscrits", current: usersStats?.newThisMonth || 0, target: settings?.targetInscriptions || 100, color: "bg-emerald-500" },
    { label: "Attestations", current: stats?.total || 0, target: settings?.targetAttestations || 50, color: "bg-blue-500" },
    { label: "Validations", current: stats?.validated || 0, target: settings?.targetValidations || 75, color: "bg-purple-500" },
  ];

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Tableau de bord</h1>
          <p className="text-slate-500 mt-1">Vue d'ensemble de votre activité - {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{newReports || 0}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Exporter les données</DropdownMenuItem>
              <DropdownMenuItem>Paramètres du dashboard</DropdownMenuItem>
              <DropdownMenuItem>Aide</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.title} className="p-6 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">{stat.title}</p>
                <p className="text-3xl font-bold mt-1 text-slate-800">
                  {statsLoading ? (
                    <Loader2 className="animate-spin w-8 h-8 text-slate-300" />
                  ) : (
                    stat.value.toLocaleString('fr-FR')
                  )}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Users Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8" />
            <div>
              <p className="text-sm opacity-80">Total Utilisateurs</p>
              <p className="text-2xl font-bold">{usersStats?.total || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8" />
            <div>
              <p className="text-sm opacity-80">Candidats</p>
              <p className="text-2xl font-bold">{usersStats?.candidates || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8" />
            <div>
              <p className="text-sm opacity-80">Administrateurs</p>
              <p className="text-2xl font-bold">{usersStats?.admins || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts & Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Distribution */}
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-800">Répartition par statut</h2>
              <Badge variant="outline" className="text-sm">
                {stats?.total || 0} total
              </Badge>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium">Validées</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{validationRate}%</span>
                </div>
                <Progress value={validationRate} className="h-2 bg-emerald-100" indicatorClassName="bg-emerald-500" />
                <p className="text-xs text-slate-500 mt-1">{stats?.validated || 0} attestations</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium">En attente</span>
                  </div>
                  <span className="text-sm font-bold text-amber-600">{pendingRate}%</span>
                </div>
                <Progress value={pendingRate} className="h-2 bg-amber-100" indicatorClassName="bg-amber-500" />
                <p className="text-xs text-slate-500 mt-1">{stats?.pending || 0} attestations</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span className="text-sm font-medium">Refusées</span>
                  </div>
                  <span className="text-sm font-bold text-rose-600">{rejectedRate}%</span>
                </div>
                <Progress value={rejectedRate} className="h-2 bg-rose-100" indicatorClassName="bg-rose-500" />
                <p className="text-xs text-slate-500 mt-1">{stats?.rejected || 0} attestations</p>
              </div>
            </div>
          </Card>

          {/* Recent Attestations */}
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-800">Dernières attestations</h2>
              <Link href="/admin/attestations">
                <Button variant="ghost" size="sm" className="text-sm">
                  Voir tout
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            {statsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin w-6 h-6 text-slate-300" />
              </div>
            ) : !recentAttestations || recentAttestations.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Aucune attestation récente</p>
            ) : (
              <div className="space-y-3">
                {recentAttestations.slice(0, 5).map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                        {a.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{a.fullName}</p>
                        <p className="text-xs text-slate-500">{a.formation?.name || "-"} • {new Date(a.issuedAt).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                    <Badge
                      className={
                        a.status === "VALIDATED"
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : a.status === "REJECTED"
                          ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                          : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      }
                    >
                      {a.status === "VALIDATED" ? "Validée" : a.status === "REJECTED" ? "Refusée" : "En attente"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="p-6 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">⚡ Actions rapides</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/admin/attestations/new">
                <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-2 hover:bg-emerald-50 hover:border-emerald-300">
                  <Plus className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-medium">Attestation</span>
                </Button>
              </Link>
              <Link href="/admin/users">
                <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-300">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <span className="text-xs font-medium">Utilisateur</span>
                </Button>
              </Link>
              <Link href="/admin/formations">
                <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-300">
                  <GraduationCap className="w-5 h-5 text-purple-600" />
                  <span className="text-xs font-medium">Formation</span>
                </Button>
              </Link>
              <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-2 hover:bg-amber-50 hover:border-amber-300">
                <Download className="w-5 h-5 text-amber-600" />
                <span className="text-xs font-medium">Exporter</span>
              </Button>
            </div>
          </Card>

          {/* Objectives */}
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">🎯 Objectifs du mois</h2>
              <Calendar className="w-5 h-5 text-slate-400" />
            </div>
            <div className="space-y-4">
              {objectives.map((obj) => {
                const percentage = Math.min((obj.current / obj.target) * 100, 100);
                const isCompleted = obj.current >= obj.target;

                return (
                  <div key={obj.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">{obj.label}</span>
                      <span className="text-xs text-slate-500">
                        {obj.current} / {obj.target}
                        {isCompleted && <CheckCircle className="w-3 h-3 text-emerald-500 inline ml-1" />}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${obj.color} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Types d'attestations */}
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">📑 Types d'attestations</h2>
              <Badge variant="outline" className="text-xs">
                {stats?.total || 0} total
              </Badge>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Formation</span>
                    <span className="text-sm font-bold text-blue-600">{attestationsByType?.formation || 0}</span>
                  </div>
                  <Progress 
                    value={stats?.total ? ((attestationsByType?.formation || 0) / stats.total) * 100 : 0} 
                    className="h-2 mt-2 bg-blue-100" 
                    indicatorClassName="bg-blue-500" 
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Stage</span>
                    <span className="text-sm font-bold text-purple-600">{attestationsByType?.stage || 0}</span>
                  </div>
                  <Progress 
                    value={stats?.total ? ((attestationsByType?.stage || 0) / stats.total) * 100 : 0} 
                    className="h-2 mt-2 bg-purple-100" 
                    indicatorClassName="bg-purple-500" 
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Certification</span>
                    <span className="text-sm font-bold text-amber-600">{attestationsByType?.certification || 0}</span>
                  </div>
                  <Progress 
                    value={stats?.total ? ((attestationsByType?.certification || 0) / stats.total) * 100 : 0} 
                    className="h-2 mt-2 bg-amber-100" 
                    indicatorClassName="bg-amber-500" 
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Top Formations */}
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">🏆 Top formations</h2>
              <Link href="/admin/formations">
                <Button variant="ghost" size="sm" className="text-xs">
                  Voir tout
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {topFormations.map((formation, index) => (
                <div key={formation.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-slate-100 text-slate-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-50 text-slate-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{formation.name}</p>
                    <Progress value={formation.percentage} className="h-1.5 mt-1" indicatorClassName="bg-blue-500" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 w-12 text-right">
                    {formation.count}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Dernières activités (données réelles) */}
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">🕐 Dernières activités</h2>
              <Link href="/admin/attestations">
                <Button variant="ghost" size="sm" className="text-xs">Voir tout</Button>
              </Link>
            </div>
            <div className="space-y-4">
              {recentAttestations && recentAttestations.length > 0 ? (
                recentAttestations.slice(0, 4).map((a: any) => {
                  const timeAgo = (() => {
                    const diff = Date.now() - new Date(a.issuedAt).getTime();
                    const hours = Math.floor(diff / 3600000);
                    if (hours < 1) return "Il y a moins d'1h";
                    if (hours < 24) return `Il y a ${hours}h`;
                    return `Il y a ${Math.floor(hours / 24)}j`;
                  })();
                  return (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.fullName}</p>
                        <p className="text-xs text-slate-500">{a.formation?.name || "Attestation"} • {a.status === "VALIDATED" ? "Validée" : a.status === "REJECTED" ? "Refusée" : "En attente"}</p>
                        <p className="text-xs text-slate-400 mt-1">{timeAgo}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">Aucune activité récente</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
