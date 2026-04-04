"use client";

import { useEffect, useState } from "react";
import { Loader2, Activity, Clock, MousePointer2, ShieldAlert, Monitor, History as HistoryIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type AuditLog = {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  ipAddress: string | null;
  timestamp: string;
  oldValue: any;
  newValue: any;
};

export function UserAuditLogs({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/users/${userId}/audit-logs`);
        if (!res.ok) throw new Error("Erreur");
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white/5 rounded-[2rem] border border-white/10 border-dashed">
        <Loader2 className="w-8 h-8 text-white/20 animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chargement de l'activité...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white/5 rounded-[2rem] border border-white/10 border-dashed">
        <Activity className="w-8 h-8 text-white/10 mb-3" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aucune donnée d'audit disponible</p>
      </div>
    );
  }

  const getActionStyles = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('delete') || act.includes('block')) return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    if (act.includes('create') || act.includes('submit')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (act.includes('update') || act.includes('edit')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-4 flex items-center gap-2">
        <HistoryIcon className="w-3 h-3" /> Historique d'Audit (Récents)
      </h4>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {logs.map((log: AuditLog) => (
          <div key={log.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/[0.07] transition-all group">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className={`p-2 rounded-xl border h-fit mt-0.5 ${getActionStyles(log.action)}`}>
                  <MousePointer2 className="w-3 h-3" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white mb-0.5 uppercase tracking-wide group-hover:text-blue-400 transition-colors">
                    {log.action.replace(/_/g, ' ')}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium italic">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {format(new Date(log.timestamp), "d MMM yyyy, HH:mm", { locale: fr })}
                    </span>
                    {log.ipAddress && (
                      <span className="flex items-center gap-1">
                        <Monitor className="w-2.5 h-2.5" />
                        {log.ipAddress}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-2 py-0.5 rounded-md bg-white/10 border border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">
                {log.resource}
              </div>
            </div>
            
            {(log.oldValue || log.newValue) && (
               <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-4">
                  {log.oldValue && (
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-slate-600 uppercase">Avant</p>
                      <pre className="text-[9px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap bg-black/20 p-1 rounded">
                        {JSON.stringify(log.oldValue)}
                      </pre>
                    </div>
                  )}
                  {log.newValue && (
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">Après</p>
                      <pre className="text-[9px] text-emerald-400 overflow-hidden text-ellipsis whitespace-nowrap bg-emerald-500/5 p-1 rounded">
                        {JSON.stringify(log.newValue)}
                      </pre>
                    </div>
                  )}
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
