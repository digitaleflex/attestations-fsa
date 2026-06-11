import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ClipboardCheck,
  Trophy,
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
    pendingPortfolios,
    newReports,
    totalAttestations,
    validatedExams,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { portfolioStatus: 'PENDING_VALIDATION' } }),
    prisma.report.count({ where: { status: { in: ['NOUVEAU', 'NEW'] } } }),
    prisma.attestation.count(),
    prisma.examSession.count({ where: { status: 'PASSED' } }),
  ]);

  return {
    stats: { total: totalAttestations, validated: validatedExams },
    usersStats: { total: totalUsers, newThisMonth: newUsersThisMonth, admins: totalAdmins, candidates: totalUsers - totalAdmins },
    pendingPortfoliosCount: pendingPortfolios,
    newReports,
  };
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();
  
  const totalTasks = (data.pendingPortfoliosCount || 0) + (data.newReports || 0);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 min-h-screen animate-in fade-in duration-500">

      {/* Cognitive Message */}
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          Bonjour Admin,
        </h1>
        <p className="text-xl text-slate-500 font-medium">
          {totalTasks > 0 
            ? `Vous avez ${totalTasks} tâche${totalTasks > 1 ? 's' : ''} en attente aujourd'hui.` 
            : `Vous êtes à jour. Aucune tâche en attente aujourd'hui.`}
        </p>
      </div>

      {/* Priority Actions */}
      {totalTasks > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(data.pendingPortfoliosCount || 0) > 0 && (
            <Card className="p-6 border-2 border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 transition-colors group shadow-none">
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                    <ClipboardCheck className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Évaluations en attente</h3>
                  <p className="text-slate-600 mt-1">{data.pendingPortfoliosCount} portfolio{data.pendingPortfoliosCount > 1 ? 's' : ''} à corriger</p>
                </div>
                <Badge className="bg-indigo-600 text-white font-bold text-sm px-3 py-1 border-none hover:bg-indigo-700">Priorité</Badge>
              </div>
              <div className="mt-6">
                <Link href="/admin/tasks">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-12 text-base shadow-sm">
                    Traiter maintenant <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {(data.newReports || 0) > 0 && (
            <Card className="p-6 border-2 border-rose-100 bg-rose-50/50 hover:bg-rose-50 transition-colors group shadow-none">
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6 text-rose-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Nouveaux Signalements</h3>
                  <p className="text-slate-600 mt-1">{data.newReports} message{data.newReports > 1 ? 's' : ''} en attente</p>
                </div>
                <Badge className="bg-rose-600 text-white font-bold text-sm px-3 py-1 border-none hover:bg-rose-700">Urgent</Badge>
              </div>
              <div className="mt-6">
                <Link href="/admin/inbox">
                  <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2 h-12 text-base shadow-sm">
                    Ouvrir la boîte de réception <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Vital KPIs */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Vue d'ensemble</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border-none shadow-sm bg-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Nouveaux Inscrits</p>
                <p className="text-2xl font-bold text-slate-900">{data.usersStats.newThisMonth}</p>
              </div>
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
