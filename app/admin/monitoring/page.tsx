"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Activity,
  AlertTriangle,
  UserCheck,
  Search,
  RefreshCcw,
  Clock,
  ShieldAlert,
  Fingerprint,
  Globe,
  Database,
  History,
  Info,
  ExternalLink,
  ChevronRight,
  Filter
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

// Add orange and emerald to colors

type SecurityLog = {
  id: string;
  eventType: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  status: string;
  severity: string;
  details: any;
  timestamp: string;
};

type AuditLog = {
  id: string;
  userId: string;
  user: { name: string; email: string };
  action: string;
  resource: string;
  resourceId: string;
  oldValue: any;
  newValue: any;
  ipAddress?: string;
  timestamp: string;
};

export default function MonitoringDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    securityLogs: SecurityLog[];
    auditLogs: AuditLog[];
    stats: any;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("security");

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/monitoring");
      if (!res.ok) throw new Error("Erreur lors de la récupération des journaux");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCcw className="w-10 h-10 animate-spin text-primary" />
        <p className="text-slate-500 font-medium">Chargement du centre de surveillance...</p>
      </div>
    );
  }

  const filteredSecurity = data?.securityLogs.filter(log =>
    log.eventType.toLowerCase().includes(search.toLowerCase()) ||
    log.action?.toLowerCase().includes(search.toLowerCase()) ||
    log.ipAddress?.includes(search)
  ) || [];

  const filteredAudit = data?.auditLogs.filter(log =>
    log.user.name.toLowerCase().includes(search.toLowerCase()) ||
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.resource.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Sécurité & Audit</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Surveillance du Système
          </h1>
          <div className="text-slate-500 font-medium flex items-center gap-2">
            Supervision en temps réel des activités candidats et serveurs.
            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse">Live</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Rechercher IP, Action, Utilisateur..."
              className="pl-10 w-[300px] bg-white border-slate-200 shadow-sm focus:ring-primary/20 h-11 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            onClick={fetchLogs}
            variant="outline"
            className="h-11 w-11 rounded-xl bg-white hover:bg-slate-50"
          >
            <RefreshCcw className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        <StatsCard
          title="Alertes Critiques"
          value={data?.stats.criticalEvents || data?.stats.highSeverityCount}
          icon={ShieldAlert}
          color="rose"
          description="Incidents de sévérité critique"
        />
        <StatsCard
          title="Changements d'Onglet"
          value={data?.stats.tabSwitchEvents}
          icon={Activity}
          color="amber"
          description="Détections de navigation suspecte"
        />
        <StatsCard
          title="Triche Détectée"
          value={data?.stats.cheatingDetections}
          icon={AlertTriangle}
          color="blue"
          description="Soumissions suspectes (patterns)"
        />
        <StatsCard
          title="Examens Terminés"
          value={data?.stats.totalExamsCompleted}
          icon={UserCheck}
          color="indigo"
          description="Total des sessions validées"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        <StatsCard
          title="Soumissions Trop Rapides"
          value={data?.stats.submissionFlags}
          icon={Clock}
          color="orange"
          description="Temps de completion suspect"
        />
        <StatsCard
          title="Candidats Actifs"
          value={data?.stats.totalCandidates}
          icon={UserCheck}
          color="emerald"
          description="Utilisateurs enregistrés"
        />
        <StatsCard
          title="Alertes Hautes"
          value={data?.stats.highSeverityCount}
          icon={Shield}
          color="purple"
          description="Sévérité haute totale"
        />
      </div>

      {/* Logs Table Section */}
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="security" className="space-y-6" onValueChange={setActiveTab}>
          <div className="flex items-center justify-between bg-white/50 p-1.5 rounded-2xl border border-slate-200/60 backdrop-blur-sm">
            <TabsList className="bg-transparent gap-2 h-auto">
              <TabsTrigger
                value="security"
                className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary h-11 px-6 font-bold flex gap-2"
              >
                <Shield className="w-4 h-4" /> Journaux de Sécurité
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary h-11 px-6 font-bold flex gap-2"
              >
                <History className="w-4 h-4" /> Audit des Ressources
              </TabsTrigger>
            </TabsList>
            <div className="px-4 hidden md:flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Filter className="w-3 h-3" />
              Trié par date décroissante
            </div>
          </div>

          <TabsContent value="security" className="space-y-4 outline-none">
            {filteredSecurity.map((log) => (
              <SecurityLogItem key={log.id} log={log} />
            ))}
            {filteredSecurity.length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="audit" className="space-y-4 outline-none">
            {filteredAudit.map((log) => (
              <AuditLogItem key={log.id} log={log} />
            ))}
            {filteredAudit.length === 0 && <EmptyState />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color, description }: any) {
  const colors: any = {
    rose: "from-rose-500 to-rose-600 shadow-rose-100 text-white",
    amber: "from-amber-500 to-amber-600 shadow-amber-100 text-white",
    blue: "from-blue-500 to-blue-600 shadow-blue-100 text-white",
    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-100 text-white",
    orange: "from-orange-500 to-orange-600 shadow-orange-100 text-white",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-100 text-white",
    purple: "from-purple-500 to-purple-600 shadow-purple-100 text-white"
  };

  const bgLight: any = {
    rose: "bg-rose-50",
    amber: "bg-amber-50",
    blue: "bg-blue-50",
    indigo: "bg-indigo-50",
    orange: "bg-orange-50",
    emerald: "bg-emerald-50",
    purple: "bg-purple-50"
  };

  return (
    <Card className="p-6 border-none shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative">
      <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-10 ${bgLight[color]}`} />
      <div className="flex flex-col gap-4 relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-black text-slate-800 tracking-tight">{value || 0}</p>
          <p className="font-bold text-slate-500 text-xs uppercase tracking-wider">{title}</p>
        </div>
        <p className="text-[10px] text-slate-400 font-medium">{description}</p>
      </div>
    </Card>
  );
}

function SecurityLogItem({ log }: { log: SecurityLog }) {
  const isHigh = log.severity === 'HIGH';
  const isWarning = log.severity === 'MEDIUM' || log.status === 'FLAGGED';

  return (
    <Card className={`p-4 border-none shadow-sm hover:shadow-md transition-all group overflow-hidden relative ${isHigh ? 'bg-rose-50/30' : isWarning ? 'bg-amber-50/30' : 'bg-white'}`}>
      <div className={`absolute left-0 top-0 w-1 h-full ${isHigh ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-slate-200'}`} />
      <div className="flex items-center gap-6">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isHigh ? 'bg-rose-100 text-rose-600' : isWarning ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
          <Fingerprint className="w-5 h-5" />
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              {log.eventType}
              {isHigh && <Badge className="bg-rose-500 text-[9px] h-4">Danger</Badge>}
            </h4>
            <p className="text-[10px] text-slate-500 font-mono tracking-tight">{log.id}</p>
          </div>

          <div className="space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-slate-400">Action</div>
            <div className="text-sm font-semibold text-slate-700">{log.action || "Aucune"}</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-slate-400">Origine</div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Globe className="w-3.5 h-3.5 text-slate-300" />
              {log.ipAddress || "Interne"}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pr-2">
            <Clock className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs font-bold text-slate-400">
              {new Date(log.timestamp).toLocaleString("fr-FR", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </Button>
      </div>
    </Card>
  );
}

function AuditLogItem({ log }: { log: AuditLog }) {
  return (
    <Card className="p-4 border-none shadow-sm hover:shadow-md transition-all group overflow-hidden relative bg-white">
      <div className="absolute left-0 top-0 w-1 h-full bg-blue-400" />
      <div className="flex items-center gap-6">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
          <Database className="w-5 h-5" />
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800">{log.user.name}</h4>
            <p className="text-[10px] text-slate-400 font-medium">{log.user.email}</p>
          </div>

          <div className="space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-slate-400">Action</div>
            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 uppercase text-[9px]">{log.action}</Badge>
          </div>

          <div className="space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-slate-400">Ressource</div>
            <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-slate-300" />
              {log.resource}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pr-2">
            <Clock className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs font-bold text-slate-400">
              {new Date(log.timestamp).toLocaleString("fr-FR")}
            </span>
          </div>
        </div>

        <Button variant="ghost" size="icon">
          <ExternalLink className="w-4 h-4 text-slate-300" />
        </Button>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-3xl border-2 border-dashed border-slate-200">
      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
        <Search className="w-8 h-8 text-slate-200" />
      </div>
      <h3 className="font-bold text-slate-600">Aucun journal trouvé</h3>
      <p className="text-sm text-slate-400 font-medium">Réessayez avec d'autres filtres ou attendez une activité.</p>
    </div>
  );
}
