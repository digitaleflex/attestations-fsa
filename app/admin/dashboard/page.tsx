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

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

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
