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
  ChevronRight,
  Filter,
  User,
  Eye,
  FileSearch
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle, 
    SheetDescription 
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SecurityLog = {
  id: string;
  eventType: string;
  userId?: string;
  user?: { name: string; email: string };
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  status: string;
  severity: string;
  details: Record<string, unknown>;
  timestamp: string;
};

interface MonitoringStats {
  highSeverityCount: number;
  submissionFlags: number;
  totalExamsCompleted: number;
  totalCandidates: number;
  tabSwitchEvents: number;
  cheatingDetections: number;
  criticalEvents: number;
  pendingReviewCount: number;
}

type AuditLog = {
  id: string;
  userId: string;
  user: { name: string; email: string };
  action: string;
  resource: string;
  resourceId: string;
  oldValue: unknown;
  newValue: unknown;
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
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/monitoring");
      if (!res.ok) throw new Error("Erreur lors de la récupération des journaux");
      const json = await res.json();
      setData(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 45000); 
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCcw className="w-10 h-10 animate-spin text-primary opacity-20" />
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Initialisation du centre de surveillance...</p>
      </div>
    );
  }

  const filteredSecurity = data?.securityLogs.filter(log =>
    log.eventType.toLowerCase().includes(search.toLowerCase()) ||
    log.action?.toLowerCase().includes(search.toLowerCase()) ||
    log.ipAddress?.includes(search) ||
    log.user?.name.toLowerCase().includes(search.toLowerCase()) ||
    log.user?.email.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredAudit = data?.auditLogs.filter(log =>
    log.user.name.toLowerCase().includes(search.toLowerCase()) ||
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.resource.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen pb-20 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Centre de Commandement</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Surveillance & Sécurité
          </h1>
          <div className="text-slate-500 font-medium flex items-center gap-2">
            Supervision 360° des activités critiques du système.
            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse font-black text-[9px] uppercase tracking-widest">Système Actif</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative group flex-1 min-w-0 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="IP, Nom, Action, Utilisateur..."
              className="pl-10 w-full sm:w-[300px] bg-white border-slate-200 shadow-sm focus:ring-primary/20 h-11 rounded-xl font-bold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            onClick={fetchLogs}
            variant="outline"
            className="h-11 w-11 rounded-xl bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
          >
            <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-7xl mx-auto">
        <StatsCard
          title="Alertes Critiques"
          value={data?.stats.criticalEvents}
          icon={ShieldAlert}
          color="rose"
          description="Incidents de sévérité critique"
        />
        <StatsCard
          title="Suspicion Triche"
          value={data?.stats.cheatingDetections}
          icon={AlertTriangle}
          color="amber"
          description="Navigation suspecte détectée"
        />
        <StatsCard
          title="Examens en cours"
          value={data?.stats.pendingReviewCount}
          icon={Activity}
          color="blue"
          description="Sessions en attente de validation"
        />
        <StatsCard
          title="Candidats Actifs"
          value={data?.stats.totalCandidates}
          icon={UserCheck}
          color="indigo"
          description="Utilisateurs enregistrés"
        />
      </div>

      {/* Logs Table Section */}
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="security" className="space-y-6" onValueChange={setActiveTab}>
          <div className="flex items-center justify-between bg-white/50 p-1.5 rounded-2xl border border-slate-200/60 backdrop-blur-md">
            <TabsList className="bg-transparent gap-2 h-auto">
              <TabsTrigger
                value="security"
                className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-primary h-11 px-6 font-black text-xs uppercase tracking-widest flex gap-2 transition-all"
              >
                <Shield className="w-4 h-4" /> Sécurité
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-primary h-11 px-6 font-black text-xs uppercase tracking-widest flex gap-2 transition-all"
              >
                <History className="w-4 h-4" /> Audit Admin
              </TabsTrigger>
            </TabsList>
            <div className="px-4 hidden md:flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest opacity-60">
              <Filter className="w-3 h-3" />
              Tri chronologique inverse
            </div>
          </div>

          <TabsContent value="security" className="space-y-4 outline-none">
            {filteredSecurity.map((log) => (
              <SecurityLogItem key={log.id} log={log} onSelect={setSelectedLog} />
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

      {/* Details Sheet */}
      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent className="sm:max-w-xl p-0 border-l-slate-100 overflow-y-auto">
          {selectedLog && (
            <div className="h-full flex flex-col">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 text-primary mb-4">
                        <FileSearch className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Détails de l'incident</span>
                    </div>
                    <SheetTitle className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                        {selectedLog.eventType}
                    </SheetTitle>
                    <div className="flex items-center gap-4">
                        <Badge className={cn(
                            "font-black text-[10px] uppercase tracking-widest px-3 py-1",
                            selectedLog.severity === 'HIGH' || selectedLog.severity === 'CRITICAL' ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                        )}>
                            Sévérité: {selectedLog.severity}
                        </Badge>
                        <span className="text-xs text-slate-400 font-bold flex items-center gap-1 uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(selectedLog.timestamp).toLocaleString("fr-FR")}
                        </span>
                    </div>
                </div>

                <div className="p-8 space-y-8 flex-1">
                    {/* User Context */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <User className="w-3 h-3" /> Contexte Utilisateur
                        </h4>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            {selectedLog.user ? (
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-slate-400">
                                        {selectedLog.user.name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-black text-slate-900">{selectedLog.user.name}</span>
                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedLog.user.email}</span>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-sm font-bold text-slate-400">Utilisateur non authentifié (Action système/publique)</span>
                            )}
                        </div>
                    </div>

                    {/* Technical details */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">IP de connexion</h4>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 font-mono text-xs font-bold text-slate-700">
                                {selectedLog.ipAddress || "Interne"}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action</h4>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700">
                                {selectedLog.action || "N/A"}
                            </div>
                        </div>
                    </div>

                    {/* Metadata / Details */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Database className="w-3 h-3" /> Données brutes de l'événement
                        </h4>
                        <div className="p-6 rounded-2xl bg-slate-900 border-none shadow-inner overflow-x-auto">
                            <pre className="text-blue-300 font-mono text-xs leading-relaxed">
                                {JSON.stringify(selectedLog.details, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-slate-100 bg-slate-50/30 flex gap-4">
                     <Button className="flex-1 bg-slate-900 h-12 rounded-xl font-bold" onClick={() => setSelectedLog(null)}>
                        Fermer l'analyse
                     </Button>
                     {selectedLog.userId && (
                        <Button variant="outline" className="h-12 rounded-xl font-bold gap-2 text-primary border-primary/20 hover:bg-primary/5">
                            <Eye className="w-4 h-4" /> Voir le profil
                        </Button>
                     )}
                </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: number | string | undefined;
  icon: React.ElementType;
  color: 'rose' | 'amber' | 'blue' | 'indigo';
  description: string;
}

function StatsCard({ title, value, icon: Icon, color, description }: StatsCardProps) {
  const colors: Record<string, string> = {
    rose: "from-rose-500 to-rose-600 shadow-rose-100/50 text-white",
    amber: "from-amber-500 to-amber-600 shadow-amber-100/50 text-white",
    blue: "from-blue-500 to-blue-600 shadow-blue-100/50 text-white",
    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-100/50 text-white"
  };

  const bgLight: Record<string, string> = {
    rose: "bg-rose-50",
    amber: "bg-amber-50",
    blue: "bg-blue-50",
    indigo: "bg-indigo-50"
  };

  return (
    <Card className="p-6 border-none shadow-xl shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative bg-white">
      <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-30 group-hover:scale-110 transition-transform", bgLight[color])} />
      <div className="flex flex-col gap-5 relative z-10">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-xl transition-transform group-hover:rotate-6", colors[color])}>
          <Icon className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <p className="text-4xl font-black text-slate-800 tracking-tighter">{value || 0}</p>
          <p className="font-black text-slate-400 text-[10px] uppercase tracking-widest">{title}</p>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60 underline decoration-slate-100 underline-offset-4">{description}</p>
      </div>
    </Card>
  );
}

function SecurityLogItem({ log, onSelect }: { log: SecurityLog, onSelect: (l: SecurityLog) => void }) {
  const isHigh = log.severity === 'HIGH' || log.severity === 'CRITICAL';
  const isWarning = log.severity === 'MEDIUM' || log.status === 'FLAGGED';

  return (
    <Card className="p-2 border-none shadow-sm hover:shadow-2xl hover:shadow-slate-200 transition-all group overflow-hidden bg-white/50 backdrop-blur-sm border border-white">
      <div className="flex items-center gap-6 p-2">
        <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-95",
            isHigh ? 'bg-rose-50 text-rose-500 shadow-inner' : isWarning ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'
        )}>
          {isHigh ? <ShieldAlert className="w-6 h-6" /> : <Fingerprint className="w-6 h-6" />}
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          <div className="space-y-1">
            <h4 className="font-black text-slate-800 flex items-center gap-2 tracking-tight">
              {log.eventType}
              {isHigh && <Badge className="bg-rose-500 text-[9px] font-black h-4 px-2 uppercase tracking-widest border-none">Alerte</Badge>}
            </h4>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest truncate max-w-[150px]">{log.user?.name || "Action Système"}</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Opération</div>
            <div className="text-xs font-bold text-slate-700 truncate">{log.action || "--"}</div>
          </div>

          <div className="space-y-1">
            <div className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Origine Réseau</div>
            <div className="flex items-center gap-2 text-xs font-black text-slate-500 font-mono">
              <Globe className="w-3.5 h-3.5 text-slate-200" />
              {log.ipAddress || "Intra"}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pr-4">
             <div className="text-right">
                <p className="text-xs font-black text-slate-800">{new Date(log.timestamp).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{new Date(log.timestamp).toLocaleDateString("fr-FR")}</p>
             </div>
             <Button variant="ghost" size="icon" onClick={() => onSelect(log)} className="bg-slate-50/50 hover:bg-white hover:shadow-md h-9 w-9 rounded-lg transition-all">
                <ChevronRight className="w-4 h-4 text-slate-300" />
             </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AuditLogItem({ log }: { log: AuditLog }) {
  return (
    <Card className="p-2 border-none shadow-sm hover:shadow-md transition-all group overflow-hidden relative bg-white border border-slate-100">
      <div className="absolute left-0 top-0 w-1 h-full bg-indigo-500" />
      <div className="flex items-center gap-6 p-2">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 shadow-inner">
          <Database className="w-6 h-6" />
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          <div className="space-y-1">
            <h4 className="font-black text-slate-800 tracking-tight">{log.user.name}</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.user.email}</p>
          </div>

          <div className="space-y-1">
            <div className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Action Admin</div>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-none font-black text-[9px] uppercase tracking-widest px-3 py-1">{log.action}</Badge>
          </div>

          <div className="space-y-1">
            <div className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Ressource</div>
            <div className="text-xs font-black text-slate-700 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-slate-200" />
              {log.resource}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pr-4">
             <div className="text-right">
                <p className="text-xs font-black text-slate-800">{new Date(log.timestamp).toLocaleDateString("fr-FR")}</p>
                <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 font-black uppercase tracking-widest">
                    <Clock className="w-3 h-3" />
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
             </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-white/20 rounded-3xl border-4 border-dashed border-white/50 backdrop-blur-sm">
      <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6">
        <Search className="w-10 h-10 text-slate-200" />
      </div>
      <h3 className="font-black text-slate-400 uppercase tracking-widest text-sm">Aucun journal d'activité</h3>
      <p className="text-xs text-slate-300 font-bold uppercase tracking-widest mt-2">En attente de nouveaux événements système...</p>
    </div>
  );
}

