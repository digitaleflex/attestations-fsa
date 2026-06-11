import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminTasksPage() {
  const pendingPortfolios = await prisma.user.findMany({
    where: { portfolioStatus: 'PENDING_VALIDATION' },
    select: { id: true, name: true, email: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' }
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 min-h-screen animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <ClipboardCheck className="w-8 h-8 text-indigo-500" />
          Tâches à traiter
        </h1>
        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none text-sm px-3 py-1 font-bold">
          {pendingPortfolios.length} en attente
        </Badge>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Portfolios en attente</h2>
          {pendingPortfolios.length > 0 ? (
            <div className="grid gap-4">
              {pendingPortfolios.map((user) => (
                <Card key={user.id} className="p-5 flex items-center justify-between border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                      {(user.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{user.name || user.email}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>Soumis le {new Date(user.updatedAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                  <Link href={`/admin/portfolios/${user.id}`}>
                    <Button variant="outline" className="font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                      Évaluer
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900">Tout est à jour !</h3>
              <p className="text-slate-500 mt-1">Aucun portfolio en attente de validation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
