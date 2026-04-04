"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, CheckCircle, Clock, XCircle, Users, GraduationCap, Award, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function AdminStatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/public/stats");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: usersStats } = useQuery({
    queryKey: ["users-stats"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return null;
      const users = await res.json();
      return {
        total: users.length,
        admins: users.filter((u: any) => u.role === "admin").length,
        candidates: users.filter((u: any) => u.role === "user").length,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
      </div>
    );
  }

  const validationRate = stats?.total ? Math.round((stats.validated / stats.total) * 100) : 0;
  const pendingRate = stats?.total ? Math.round((stats.pending / stats.total) * 100) : 0;
  const rejectedRate = stats?.total ? Math.round((stats.rejected / stats.total) * 100) : 0;

  const statCards = [
    {
      title: "Total Attestations",
      value: stats?.total || 0,
      icon: FileText,
      color: "from-blue-500 to-blue-600",
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "Validées",
      value: stats?.validated || 0,
      icon: CheckCircle,
      color: "from-emerald-500 to-emerald-600",
      trend: "+15%",
      trendUp: true,
    },
    {
      title: "En attente",
      value: stats?.pending || 0,
      icon: Clock,
      color: "from-amber-500 to-amber-600",
      trend: "-3%",
      trendUp: false,
    },
    {
      title: "Rejetées",
      value: stats?.rejected || 0,
      icon: XCircle,
      color: "from-rose-500 to-rose-600",
      trend: "+5%",
      trendUp: false,
    },
  ];

  const userCards = [
    {
      title: "Total Utilisateurs",
      value: usersStats?.total || 0,
      icon: Users,
      color: "from-purple-500 to-purple-600",
    },
    {
      title: "Candidats",
      value: usersStats?.candidates || 0,
      icon: GraduationCap,
      color: "from-emerald-500 to-emerald-600",
    },
    {
      title: "Administrateurs",
      value: usersStats?.admins || 0,
      icon: Award,
      color: "from-blue-500 to-blue-600",
    },
  ];

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">📈 Statistiques</h1>
            <p className="text-slate-500 mt-1">Vue d'ensemble de votre activité</p>
          </div>
          <Badge variant="outline" className="gap-2">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Badge>
        </div>

        {/* Cartes Attestations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const TrendIcon = stat.trendUp ? TrendingUp : TrendingDown;
            return (
              <Card key={stat.title} className="p-6 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                    stat.color
                  )}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                    stat.trendUp ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                  )}>
                    <TrendIcon className="w-3 h-3" />
                    {stat.trend}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1 text-slate-800">
                    {stat.value.toLocaleString('fr-FR')}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Cartes Utilisateurs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {userCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="p-6 bg-white shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                    stat.color
                  )}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">{stat.title}</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {stat.value.toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Répartition par statut */}
        <Card className="p-6 bg-white shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6">📊 Répartition par statut</h2>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium">Validées</span>
                </div>
                <span className="text-sm font-bold text-emerald-600">{validationRate}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${validationRate}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{stats?.validated || 0} attestations</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium">En attente</span>
                </div>
                <span className="text-sm font-bold text-amber-600">{pendingRate}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${pendingRate}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{stats?.pending || 0} attestations</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span className="text-sm font-medium">Rejetées</span>
                </div>
                <span className="text-sm font-bold text-rose-600">{rejectedRate}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${rejectedRate}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{stats?.rejected || 0} attestations</p>
            </div>
          </div>
        </Card>

        {/* Résumé */}
        <Card className="p-6 bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold mb-2">🎯 Taux de validation global</h3>
              <p className="text-emerald-100 text-sm">
                {stats?.validated || 0} attestations validées sur {stats?.total || 0}
              </p>
            </div>
            <div className="text-5xl font-bold">{validationRate}%</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
