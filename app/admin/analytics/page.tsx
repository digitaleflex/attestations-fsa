"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/admin";
import { PageHeader } from "@/components/admin";
import { apiFetch } from "@/lib/api-client";
import { Users, UserCheck, BadgeCheck, Award, Loader2, AlertTriangle, RotateCw } from "lucide-react";

type UserStats = { total: number; active: number; verified: number; unverified: number };
type Formation = { id: string; name: string; category: string };
type Learner = { id: string; name: string; email: string; createdAt: string; status?: string };

const PIE_COLORS = ["#dc2626","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#64748b"];

function lastMonths(n = 12) {
  const res: { key: string; label: string; count: number }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    res.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("fr-FR", { month: "short" }), count: 0 });
  }
  return res;
}
function monthKey(iso: string) { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}`; }

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [attestationCount, setAttestationCount] = useState<number | null>(null);
  const [users, setUsers] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [s, f, a] = await Promise.all([
        apiFetch<UserStats>("/api/users/stats"),
        apiFetch<Formation[]>("/api/formations"),
        apiFetch<{ count?: number }>("/api/attestations?count=1"),
      ]);
      const all: Learner[] = [];
      let page = 1;
      let total = Infinity;
      while (all.length < total && page <= 50) {
        const res = await apiFetch<{ items?: Learner[]; meta?: { total?: number } }>(`/api/users?limit=100&page=${page}&sort=createdAt&direction=asc`);
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? (res as Learner[]) : [];
        all.push(...items);
        total = res?.meta?.total ?? all.length;
        if (items.length < 100) break;
        page += 1;
      }
      setStats(s);
      setFormations(Array.isArray(f) ? f : []);
      setAttestationCount(typeof a?.count === "number" ? a.count : null);
      setUsers(all);
    } catch (err) {
      console.error("[admin/analytics] chargement impossible:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const months = React.useMemo(() => {
    const base = lastMonths(12);
    const map = new Map(base.map((m) => [m.key, m]));
    for (const u of users) {
      if (!u?.createdAt) continue;
      const k = monthKey(u.createdAt);
      const m = map.get(k);
      if (m) m.count += 1;
    }
    return base;
  }, [users]);

  const maxMonth = Math.max(1, ...months.map((m) => m.count));

  const categoryCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const f of formations) {
      const cat = f.category || "Autre";
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [formations]);

  const totalCat = categoryCounts.reduce((s, c) => s + c.value, 0);

  const latest = React.useMemo(() => {
    return [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  }, [users]);

  const pieSegments = React.useMemo(() => {
    if (totalCat === 0) return "";
    let acc = 0;
    const parts: string[] = [];
    categoryCounts.forEach((c, i) => {
      const start = (acc / totalCat) * 360;
      acc += c.value;
      const end = (acc / totalCat) * 360;
      parts.push(`${PIE_COLORS[i % PIE_COLORS.length]} ${start}deg ${end}deg`);
    });
    return parts.join(", ");
  }, [categoryCounts, totalCat]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--admin-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <PageHeader title="Analytique" description="Tableau de bord analytique" />
        <div role="status" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">Impossible de charger les données analytiques.</p>
          </div>
          <button onClick={load} className="inline-flex h-11 min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-amber-600 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700 sm:self-auto">
            <RotateCw className="h-4 w-4" /> Recharger
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 min-h-screen animate-in fade-in duration-500">
      <PageHeader title="Analytique" description="Vue d'ensemble des apprenants, formations et attestations." breadcrumb={[{ label: "Administration", href: "/admin/dashboard" }, { label: "Analytique" }]} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total apprenants" value={stats?.total ?? "—"} icon={Users} color="brand" />
        <StatCard title="Apprenants actifs" value={stats?.active ?? "—"} icon={UserCheck} color="success" />
        <StatCard title="Apprenants vérifiés" value={stats?.verified ?? "—"} icon={BadgeCheck} color="warning" />
        <StatCard title="Attestations délivrées" value={attestationCount ?? "—"} icon={Award} color="error" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-base font-bold text-[var(--admin-text)] mb-4">Évolution des inscriptions par mois</h2>
          <div className="flex items-end gap-1.5 h-48">
            {months.map((m) => {
              const height = (m.count / maxMonth) * 100;
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] text-[var(--admin-text-secondary)] tabular-nums">{m.count}</span>
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full rounded-t bg-[var(--admin-primary)] transition-all" style={{ height: `${Math.max(height, m.count > 0 ? 4 : 0)}%` }} title={`${m.label}: ${m.count}`} />
                  </div>
                  <span className="text-[10px] text-[var(--admin-text-secondary)] truncate">{m.label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold text-[var(--admin-text)] mb-4">Répartition par catégorie de formation</h2>
          {totalCat === 0 ? (
            <p className="text-sm text-[var(--admin-text-secondary)]">Aucune formation.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-40 h-40 rounded-full shrink-0 shadow-sm" style={{ background: `conic-gradient(${pieSegments})` }} role="img" aria-label="Répartition par catégorie de formation" />
              <ul className="space-y-2 text-sm w-full">
                {categoryCounts.map((c, i) => (
                  <li key={c.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate text-[var(--admin-text)]">{c.label}</span>
                    </span>
                    <span className="text-[var(--admin-text-secondary)] tabular-nums">{c.value} ({Math.round((c.value / totalCat) * 100)}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-base font-bold text-[var(--admin-text)] mb-4">5 derniers apprenants inscrits</h2>
        {latest.length === 0 ? (
          <p className="text-sm text-[var(--admin-text-secondary)]">Aucun apprenant.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latest.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{u.status ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
