"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  Mail, 
  Calendar, 
  Search, 
  RefreshCcw, 
  Download,
  Filter,
  MoreVertical,
  CheckCircle,
  Clock,
  ExternalLink,
  XCircle,
  Loader2,
  Trash2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

type WaitlistEntry = {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  status: string;
  source: string;
  createdAt: string;
};

export default function WaitlistAdminPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/waitlist") as any;
      setEntries(data.waitlist || []);
    } catch (err) {
      toast.error("Impossible de charger la liste d'attente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch("/api/admin/waitlist", {
        method: "PATCH",
        body: JSON.stringify({ id, status })
      });
      toast.success("Statut mis à jour");
      fetchEntries();
    } catch (err) {
      toast.error("Erreur de mise à jour");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette inscription ?")) return;
    try {
      await apiFetch(`/api/admin/waitlist?id=${id}`, { method: "DELETE" });
      toast.success("Inscription supprimée");
      fetchEntries();
    } catch (err) {
      toast.error("Erreur de suppression");
    }
  };

  const exportToCSV = () => {
    if (entries.length === 0) return;
    const headers = ["Nom", "Email", "Statut", "Source", "Date", "Message"];
    const csvContent = entries.map(e => [
      e.name || "N/A",
      e.email,
      e.status,
      e.source,
      new Date(e.createdAt).toLocaleDateString(),
      (e.message || "").replace(/,/g, " ").replace(/\n/g, " ")
    ].join(",")).join("\n");
    
    const blob = new Blob([[headers.join(","), csvContent].join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist_fsa_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filtered = entries.filter(e => {
    const matchesSearch = e.email.toLowerCase().includes(search.toLowerCase()) || 
                         (e.name && e.name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = filterStatus === "ALL" || e.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: entries.length,
    pending: entries.filter(e => e.status === 'PENDING').length,
    converted: entries.filter(e => e.status === 'CONVERTED').length,
    newThisMonth: entries.filter(e => new Date(e.createdAt).getMonth() === new Date().getMonth()).length,
  };

  return (
    <div className="p-6 lg:p-10 space-y-8 bg-slate-50/50 min-h-screen pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Users className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Prospects & Marketing</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Liste d&apos;Attente</h1>
          <p className="text-slate-500 font-medium tracking-tight">Gérez les contacts intéressés par vos formations.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={exportToCSV}
            className="bg-slate-900 hover:bg-slate-800 h-11 rounded-xl font-bold gap-2 px-6 shadow-xl shadow-slate-200"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={fetchEntries}
            className="h-11 w-11 rounded-xl bg-white border-slate-200 shadow-sm"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-7xl mx-auto">
        <StatsCard 
          title="Total prospects" 
          value={stats.total} 
          icon={Users}
          color="indigo"
          subValue="Tous canaux confondus"
        />
        <StatsCard 
          title="En attente" 
          value={stats.pending} 
          icon={Clock}
          color="amber"
          subValue="Nécessite une action"
        />
        <StatsCard 
          title="Convertis" 
          value={stats.converted}
          icon={CheckCircle}
          color="emerald"
          subValue="Inscrits finalisés"
        />
        <StatsCard 
          title="Ce mois" 
          value={stats.newThisMonth}
          icon={Calendar}
          color="rose"
          subValue="Nouveaux inscrits"
        />
      </div>

      {/* List & Filtering */}
      <Card className="max-w-7xl mx-auto border-none shadow-2xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 font-bold" />
            <Input 
              placeholder="Rechercher IP, Action, Utilisateur..."
              className="pl-10 h-11 bg-slate-50 border-none rounded-xl focus:ring-slate-200 font-bold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 bg-slate-50 p-1 rounded-xl">
             {["ALL", "PENDING", "CONTACTED", "CONVERTED"].map((s) => (
                <Button 
                  key={s}
                  variant={filterStatus === s ? "default" : "ghost"} 
                  size="sm" 
                  className={cn(
                    "rounded-lg h-9 px-4 font-black text-[10px] uppercase tracking-widest transition-all",
                    filterStatus === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                  )}
                  onClick={() => setFilterStatus(s)}
                >
                  {s === "ALL" ? "Tous" : s === "PENDING" ? "En attente" : s === "CONTACTED" ? "Contactés" : "Convertis"}
                </Button>
             ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Chargement des données...</p>
             </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200">
                    <Users className="w-8 h-8" />
                </div>
                <p className="font-bold text-slate-400">Aucun résultat trouvé.</p>
            </div>
          ) : (
            <table className="w-full text-left">
                <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                    <th className="px-8 py-4">Utilisateur</th>
                    <th className="px-8 py-4">Statut</th>
                    <th className="px-8 py-4">Détails</th>
                    <th className="px-8 py-4">Date</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                {filtered.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 font-black shadow-sm group-hover:scale-105 transition-transform uppercase">
                                {entry.email.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-black text-slate-900 tracking-tight">{entry.name || "Candidat Anonyme"}</span>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">{entry.email}</span>
                            </div>
                        </div>
                    </td>
                    <td className="px-8 py-6">
                        <Badge className={cn(
                        "font-black text-[10px] uppercase border-none px-3 py-1 tracking-widest",
                        entry.status === "PENDING" ? "bg-amber-100 text-amber-700 shadow-lg shadow-amber-100/50" :
                        entry.status === "CONTACTED" ? "bg-blue-100 text-blue-700 shadow-lg shadow-blue-100/50" :
                        entry.status === "CONVERTED" ? "bg-emerald-100 text-emerald-700 shadow-lg shadow-emerald-100/50" :
                        "bg-slate-100 text-slate-500"
                        )}>
                        {entry.status === 'PENDING' ? 'En attente' : entry.status === 'CONTACTED' ? 'Contacté' : 'Converti'}
                        </Badge>
                    </td>
                    <td className="px-8 py-6">
                        <div className="flex flex-col max-w-[250px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Filter className="w-3 h-3" /> Origine: {entry.source}
                            </span>
                            <span className="text-xs text-slate-600 font-medium line-clamp-2 italic">
                                {entry.message ? `"${entry.message}"` : "-- Pas de message --"}
                            </span>
                        </div>
                    </td>
                    <td className="px-8 py-6">
                        <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-700">{new Date(entry.createdAt).toLocaleDateString("fr-FR", { day: '2-digit', month: 'long' })}</span>
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 uppercase tracking-widest">
                            <Clock className="w-3 h-3" />
                            {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-white hover:shadow-md rounded-xl transition-all">
                                <MoreVertical className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-slate-100 shadow-2xl bg-white/95 backdrop-blur-xl">
                            <div className="px-3 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">Changer le statut</div>
                            <DropdownMenuItem 
                                className="rounded-xl font-bold text-xs flex gap-2 cursor-pointer h-10"
                                onClick={() => updateStatus(entry.id, "CONTACTED")}
                            >
                                <Mail className="w-4 h-4 text-blue-500" />
                                Marquer comme Contacté
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                className="rounded-xl font-bold text-xs flex gap-2 cursor-pointer h-10"
                                onClick={() => updateStatus(entry.id, "CONVERTED")}
                            >
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                Marquer comme Converti
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                className="rounded-xl font-bold text-xs flex gap-2 cursor-pointer h-10"
                                onClick={() => updateStatus(entry.id, "PENDING")}
                            >
                                <Clock className="w-4 h-4 text-amber-500" />
                                Remettre en Attente
                            </DropdownMenuItem>
                            <div className="h-px bg-slate-50 my-1" />
                            <DropdownMenuItem 
                                className="rounded-xl font-bold text-xs flex gap-2 text-rose-600 cursor-pointer h-10"
                                onClick={() => handleDelete(entry.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                                Supprimer le prospect
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
          )}
        </div>
      </Card>
      
      {/* Disclaimer */}
      <div className="max-w-7xl mx-auto flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest px-4">
        <ExternalLink className="w-3 h-3" /> 
        Ces données sont collectées via le portfolio public et les formulaires de pré-inscription.
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color, subValue }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600 shadow-indigo-100/50",
    amber: "bg-amber-50 text-amber-600 shadow-amber-100/50",
    emerald: "bg-emerald-50 text-emerald-600 shadow-emerald-100/50",
    rose: "bg-rose-50 text-rose-600 shadow-rose-100/50"
  };

  return (
    <Card className="p-6 border-none shadow-xl shadow-slate-200/50 bg-white relative overflow-hidden group hover:-translate-y-1 transition-all duration-500">
      <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full bg-slate-50 opacity-20 group-hover:scale-110 transition-transform" />
      <div className="flex items-start gap-4 mb-4 relative z-10">
         <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-6", colors[color])}>
           <Icon className="w-7 h-7" />
         </div>
         <div className="flex-1">
            <p className="text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">{title}</p>
         </div>
      </div>
      <div className="flex items-center gap-2 pt-4 border-t border-slate-50 relative z-10">
         <Badge variant="outline" className="bg-slate-50 text-slate-400 border-none text-[9px] font-black uppercase tracking-widest">Mise à jour live</Badge>
         <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest opacity-60">{subValue}</span>
      </div>
    </Card>
  );
}

