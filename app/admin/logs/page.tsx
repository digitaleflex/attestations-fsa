"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  History, 
  User as UserIcon, 
  Search, 
  Filter, 
  ChevronLeft,
  RefreshCcw,
  Activity,
  FileText,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { User } from "@/types";

interface SecurityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: string;
  user: User;
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logs");
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<SecurityLog[]>;
    }
  });

  const filteredLogs = logs?.filter((log: SecurityLog) => 
    log.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    log.action?.toLowerCase().includes(search.toLowerCase()) ||
    log.resource?.toLowerCase().includes(search.toLowerCase())
  );

  const getActionColor = (action: string) => {
    if (action.includes("DELETE")) return "bg-rose-100 text-rose-700 border-rose-200";
    if (action.includes("GRADE") || action.includes("UPDATE")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (action.includes("RECLAMATION")) return "bg-indigo-100 text-indigo-700 border-indigo-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const getActionLabel = (action: string) => {
    switch(action) {
      case "GRADE_EXAM": return "Notation Examen";
      case "UPDATE_GRADE": return "Modification Note";
      case "RECLAMATION_REPLY": return "Réponse Réclamation";
      case "DELETE_SUBMISSION": return "Suppression Copie";
      default: return action;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <RefreshCcw className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Chargement du journal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
               <Button variant="ghost" size="icon" className="rounded-xl">
                  <ChevronLeft className="w-5 h-5" />
               </Button>
            </Link>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
               <h1 className="text-xl font-black text-slate-900 tracking-tight">Journal d'Audit</h1>
               <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Surveillance & Sécurité</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-xl font-bold gap-2 bg-white">
               <RefreshCcw className="w-4 h-4" /> Actualiser
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              label="Actions Total" 
              value={logs?.length || 0} 
              icon={Activity} 
              color="indigo" 
            />
            <StatCard 
              label="Dernière Action" 
              value={logs?.[0] ? format(new Date(logs[0].timestamp), "HH:mm", { locale: fr }) : "--:--"} 
              icon={History} 
              color="emerald" 
            />
            <StatCard 
              label="Admins Actifs" 
              value={new Set(logs?.map((l: SecurityLog) => l.userId)).size} 
              icon={UserIcon} 
              color="blue" 
            />
        </div>

        <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-3xl bg-white overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Filtrer par admin, action ou ressource..." 
                className="pl-12 h-12 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
               <Button variant="secondary" className="rounded-xl font-bold h-12 px-6 gap-2">
                  <Filter className="w-4 h-4" /> Filtres Avancés
               </Button>
            </div>
          </div>

          {/* Vue Bureau (Tableau) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Admin</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Action</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Ressource</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Détails</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Horodatage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs?.map((log: SecurityLog) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                           {log.user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-tight">{log.user?.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{log.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={cn("px-3 py-1 font-black text-[10px] uppercase tracking-tighter rounded-lg", getActionColor(log.action))}>
                        {getActionLabel(log.action)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-slate-600">
                          <FileText className="w-4 h-4 text-slate-300" />
                          <span className="text-xs font-bold">{log.resource}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">ID: {log.resourceId.slice(0, 8)}...</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <p className="text-xs font-black text-slate-900">{format(new Date(log.timestamp), "d MMM yyyy", { locale: fr })}</p>
                       <p className="text-[10px] font-bold text-slate-400">{format(new Date(log.timestamp), "HH:mm:ss")}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vue Mobile (Cartes) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredLogs?.map((log: SecurityLog) => (
              <div key={log.id} className="p-4 space-y-3 bg-white hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                       {log.user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-tight truncate">{log.user?.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{log.user?.email}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black text-slate-900">{format(new Date(log.timestamp), "HH:mm:ss")}</p>
                    <p className="text-[9px] font-bold text-slate-400">{format(new Date(log.timestamp), "d MMM yyyy", { locale: fr })}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={cn("px-2 py-0.5 font-black text-[9px] uppercase tracking-tighter rounded-lg shrink-0", getActionColor(log.action))}>
                    {getActionLabel(log.action)}
                  </Badge>
                  <div className="flex items-center gap-1 text-slate-500 min-w-0">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="text-[10px] font-bold truncate">{log.resource}</span>
                  </div>
                </div>
                
                <div className="text-[9px] font-mono bg-slate-50 p-1.5 rounded text-slate-400 truncate">
                  Target ID: {log.resourceId}
                </div>
              </div>
            ))}
          </div>

          {(filteredLogs?.length === 0 || !filteredLogs) && (
            <div className="p-20 flex flex-col items-center justify-center text-center">
               <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-slate-200" />
               </div>
               <h3 className="text-slate-900 font-black tracking-tight">Aucun log trouvé</h3>
               <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Modifiez vos critères de recherche</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: any;
  color: "indigo" | "emerald" | "blue";
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <Card className="p-6 border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl group hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between">
         <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
         </div>
         <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-6", colors[color])}>
            <Icon className="w-7 h-7" />
         </div>
      </div>
    </Card>
  );
}
