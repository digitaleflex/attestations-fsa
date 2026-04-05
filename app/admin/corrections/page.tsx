"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  FileText, 
  AlertCircle,
  RefreshCw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface Correction {
  id: string;
  status: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  user: {
    name: string;
    email: string;
  };
  attestation?: {
    code: string;
  };
}

export default function AdminCorrectionsPage() {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");

  useEffect(() => {
    fetchCorrections();
  }, []);

  const fetchCorrections = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/corrections");
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setCorrections(data);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/admin/corrections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Erreur");
      
      toast.success(status === "APPROVED" ? "Demande approuvée !" : "Demande rejetée");
      fetchCorrections();
    } catch {
      toast.error("Erreur de mise à jour");
    }
  };

  const filtered = corrections.filter(c => filter === "ALL" ? true : c.status === filter);

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Demandes de Correction</h1>
          <p className="text-slate-500 font-medium">Gérez les demandes de modification d&apos;identité des candidats.</p>
        </div>
        <Button onClick={fetchCorrections} variant="outline" className="h-11 rounded-xl font-bold border-slate-200">
           <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
           Actualiser
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 max-w-fit">
        {["PENDING", "APPROVED", "REJECTED", "ALL"].map(s => (
          <Button 
            key={s} 
            size="sm"
            variant={filter === s ? "default" : "ghost"}
            onClick={() => setFilter(s)}
            className={`rounded-xl px-4 py-2 font-bold text-xs ${filter === s ? "bg-slate-900 shadow-lg shadow-slate-200" : "text-slate-500"}`}
          >
            {s === "PENDING" ? "En attente" : s === "APPROVED" ? "Approuvées" : s === "REJECTED" ? "Rejetées" : "Toutes"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="font-bold">Chargement des demandes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-20 text-center border-dashed border-2 border-slate-200 bg-slate-50">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">Aucune demande trouvée dans cette catégorie.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map(c => (
            <Card key={c.id} className="p-6 border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all duration-300 relative overflow-hidden group">
               <div className="flex justify-between items-start mb-6">
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover:scale-110 transition-transform">
                      <User className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="font-black text-slate-900 tracking-tight">{c.user.name}</p>
                     <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{c.user.email}</p>
                   </div>
                 </div>
                 <Badge className={`border-none px-3 py-1 text-[10px] uppercase font-black tracking-widest ${
                   c.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                   c.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                 }`}>
                   {c.status}
                 </Badge>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Actuel ({c.field})</p>
                    <p className="text-sm font-bold text-rose-900">{c.oldValue || "--"}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Souhaité</p>
                    <p className="text-sm font-bold text-emerald-900">{c.newValue}</p>
                  </div>
               </div>

               {c.reason && (
                 <div className="p-4 rounded-2xl bg-slate-50 mb-6 text-xs text-slate-600 italic">
                    &quot; {c.reason} &quot;
                 </div>
               )}

               {c.status === "PENDING" && (
                 <div className="flex gap-3 pt-4 border-t border-slate-100">
                   <Button onClick={() => handleUpdate(c.id, "APPROVED")} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-11 rounded-xl font-bold shadow-lg shadow-emerald-100">
                      Approuver le changement
                   </Button>
                   <Button onClick={() => handleUpdate(c.id, "REJECTED")} variant="outline" className="flex-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100 h-11 rounded-xl font-bold">
                      Rejeter
                   </Button>
                 </div>
               )}

               {c.attestation && (
                 <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                    <FileText className="w-3 h-3" />
                    Attestation: {c.attestation.code}
                 </div>
               )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
