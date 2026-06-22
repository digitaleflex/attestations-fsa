import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
<<<<<<< HEAD
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ClipboardCheck,
  Trophy,
=======
  Eye,
  MoreHorizontal,
  ArrowUpRight,
  Award,
  Bell,
  Search,
  Activity,
  Layers,
  ShieldCheck,
  ClipboardCheck
>>>>>>> c47c5e1 (refactor: supprime les modules Portfolio, Chat, Ressources, Waitlist et Annuaire)
} from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getDashboardData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    newUsersThisMonth,
    totalAdmins,
    totalAttestations,
    validatedExams,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.attestation.count(),
    prisma.examSession.count({ where: { status: 'PASSED' } }),
  ]);

  return {
    stats: { total: totalAttestations, validated: validatedExams },
    usersStats: { total: totalUsers, newThisMonth: newUsersThisMonth, admins: totalAdmins, candidates: totalUsers - totalAdmins },
  };
}

<<<<<<< HEAD
export default async function AdminDashboardPage() {
  const data = await getDashboardData();
=======
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
>>>>>>> c47c5e1 (refactor: supprime les modules Portfolio, Chat, Ressources, Waitlist et Annuaire)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 min-h-screen animate-in fade-in duration-500">

      {/* Cognitive Message */}
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          Bonjour Admin,
        </h1>
        <p className="text-xl text-slate-500 font-medium">
          Bienvenue sur la console de gestion des attestations et des examens.
        </p>
      </div>

      {/* Vital KPIs */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Vue d'ensemble</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border-none shadow-sm bg-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
<<<<<<< HEAD
              <div>
                <p className="text-sm font-medium text-slate-500">Nouveaux Inscrits</p>
                <p className="text-2xl font-bold text-slate-900">{data.usersStats.newThisMonth}</p>
              </div>
=======
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
>>>>>>> c47c5e1 (refactor: supprime les modules Portfolio, Chat, Ressources, Waitlist et Annuaire)
            </div>
          </Card>

          <Card className="p-6 border-none shadow-sm bg-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Attestations Délivrées</p>
                <p className="text-2xl font-bold text-slate-900">{data.stats.total}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-none shadow-sm bg-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Validations (Exams)</p>
                <p className="text-2xl font-bold text-slate-900">{data.stats.validated}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
