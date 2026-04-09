"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Search, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  RefreshCcw,
  User as UserIcon
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function AdminPortfoliosPage() {
  const [search, setSearch] = useState("");

  const { data: portfolios, isLoading, refetch } = useQuery({
    queryKey: ["admin-portfolios"],
    queryFn: async () => {
      const res = await fetch("/api/admin/portfolios");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    }
  });

  const filtered = portfolios?.filter((p: any) => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="p-20 text-center">Chargement des portfolios...</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
             <Trophy className="w-8 h-8 text-purple-600" /> Validation des Portfolios
          </h1>
          <p className="text-slate-500 font-medium">Gérez et validez les vitrines professionnelles des candidats.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-premium">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Chercher un candidat..." 
                className="pl-10 w-64 border-none bg-slate-50 rounded-xl h-11 focus-visible:ring-purple-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
           </div>
           <Button variant="ghost" size="icon" onClick={() => refetch()} className="rounded-xl h-11 w-11">
              <RefreshCcw className="w-4 h-4" />
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered?.length > 0 ? filtered.map((p: any) => (
           <Card key={p.id} className="p-6 border-none shadow-premium bg-white group hover:translate-y-[-4px] transition-all duration-300 relative overflow-hidden">
              {p.portfolioStatus === 'PENDING_VALIDATION' && (
                 <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-bl-full flex items-start justify-end p-4">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                 </div>
              )}

              <div className="flex items-center gap-4 mb-6">
                 <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-xl font-black text-purple-600 border border-slate-100">
                    {p.name?.charAt(0)}
                 </div>
                 <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{p.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{p.email}</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut</span>
                    <StatusBadge status={p.portfolioStatus} />
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dernière MàJ</span>
                    <span className="text-xs font-bold text-slate-600">{format(new Date(p.updatedAt), 'dd/MM/yyyy', { locale: fr })}</span>
                 </div>
              </div>

              <div className="mt-8 flex gap-2">
                 <Link href={`/admin/portfolios/${p.id}`} className="flex-1">
                    <Button className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200 gap-2 font-bold">
                       <Eye className="w-4 h-4" /> Examiner
                    </Button>
                 </Link>
                 {p.portfolioStatus === 'PUBLISHED' && (
                    <Link href={`/p/${p.portfolioSlug}`} target="_blank">
                       <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl bg-slate-50 text-slate-400 hover:text-purple-600">
                          <CheckCircle2 className="w-4 h-4" />
                       </Button>
                    </Link>
                 )}
              </div>
           </Card>
        )) : (
          <div className="col-span-full py-20 text-center">
             <UserIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
             <p className="text-slate-400 font-bold">Aucun portfolio trouvé.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    DRAFT: { label: "En cours", color: "bg-slate-100 text-slate-600", icon: Clock },
    PENDING_VALIDATION: { label: "À Valider", color: "bg-rose-100 text-rose-700", icon: AlertCircle },
    PUBLISHED: { label: "Publié", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    REJECTED: { label: "Refusé", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  };

  const config = configs[status] || configs.DRAFT;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`px-2 py-0.5 rounded-lg border-none font-black text-[9px] uppercase tracking-tighter gap-1 ${config.color}`}>
       <Icon className="w-3 h-3" /> {config.label}
    </Badge>
  );
}
