import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus, CheckCircle, Trophy, ArrowRight,
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
    pendingCorrections,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.attestation.count(),
    prisma.examSession.count({ where: { status: "PASSED" } }),
    prisma.correctionRequest.count(),
  ]);

  return {
    stats: { total: totalAttestations, validated: validatedExams },
    usersStats: {
      total: totalUsers,
      newThisMonth: newUsersThisMonth,
      admins: totalAdmins,
      candidates: totalUsers - totalAdmins,
    },
    corrections: pendingCorrections,
  };
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 min-h-screen animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <Badge className="bg-brand/10 text-brand border-brand/20 px-3 py-1 text-[10px] uppercase font-black tracking-widest">
            Console Admin
          </Badge>
          <h1 className="text-4xl font-black text-brand-ink tracking-tight">
            Bonjour Admin,
          </h1>
          <p className="text-brand-muted text-sm md:text-base font-medium">
            Vue d'ensemble des attestations, examens et inscriptions.
          </p>
        </div>
        <Link href="/admin/users">
          <button className="px-6 py-3 rounded-2xl bg-brand text-white font-bold text-sm hover:bg-brand-dark shadow-lg shadow-brand/20 transition-all active:scale-95 flex items-center gap-2">
            Gérer les utilisateurs
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-bold text-brand-ink mb-4">Vue d'ensemble</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 border-none shadow-sm bg-white rounded-3xl group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
              <UserPlus className="w-6 h-6 text-brand" />
            </div>
            <p className="text-sm font-medium text-brand-muted mb-1">Inscrits ce mois-ci</p>
            <p className="text-3xl font-black text-brand-ink">{data.usersStats.newThisMonth}</p>
            <p className="text-xs text-brand-muted mt-1">
              {data.usersStats.total} candidats totaux
            </p>
          </Card>

          <Card className="p-6 border-none shadow-sm bg-white rounded-3xl group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center mb-6">
              <Trophy className="w-6 h-6 text-brand-accent" />
            </div>
            <p className="text-sm font-medium text-brand-muted mb-1">Attestations</p>
            <p className="text-3xl font-black text-brand-ink">{data.stats.total}</p>
            <p className="text-xs text-brand-muted mt-1">
              {data.stats.validated} validées
            </p>
          </Card>

          <Card className="p-6 border-none shadow-sm bg-white rounded-3xl group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-6 h-6 text-brand" />
            </div>
            <p className="text-sm font-medium text-brand-muted mb-1">Examens validés</p>
            <p className="text-3xl font-black text-brand-ink">{data.stats.validated}</p>
            <p className="text-xs text-brand-muted mt-1">Sessions terminées</p>
          </Card>

          <Card className="p-6 border-none shadow-sm bg-white rounded-3xl group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
              <UserPlus className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-brand-muted mb-1">Corrections</p>
            <p className="text-3xl font-black text-brand-ink">{data.corrections}</p>
            <p className="text-xs text-brand-muted mt-1">Demandes en attente</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
