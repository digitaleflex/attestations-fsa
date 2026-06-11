import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, AlertCircle, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function AdminInboxPage() {
  const newReports = await prisma.report.findMany({
    where: { status: { in: ['NOUVEAU', 'NEW'] } },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 min-h-screen animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Inbox className="w-8 h-8 text-rose-500" />
          Boîte de réception unifiée
        </h1>
        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-none text-sm px-3 py-1 font-bold">
          {newReports.length} non lus
        </Badge>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-slate-500" />
            Signalements & Urgences
          </h2>
          {newReports.length > 0 ? (
            <div className="grid gap-4">
              {newReports.map((report) => (
                <Card key={report.id} className="p-5 flex items-center justify-between border-rose-100 bg-rose-50/30 hover:border-rose-300 hover:shadow-md transition-all shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center font-bold text-rose-600">
                      !
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{report.motif || "Signalement"}</h3>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-1">{report.message || "Aucun détail fourni"}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                        <span>Reçu le {new Date(report.createdAt).toLocaleDateString('fr-FR')}</span>
                        {report.email && <span>• De: {report.email}</span>}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="font-semibold text-rose-600 border-rose-200 hover:bg-rose-50">
                    Gérer
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900">Aucun signalement</h3>
              <p className="text-slate-500 mt-1">Votre boîte est vide.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
