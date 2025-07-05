"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [formations, setFormations] = useState<any[]>([]);
  const [selectedFormation, setSelectedFormation] = useState<string>("");
  const [period, setPeriod] = useState<{ from: string; to: string }>({ from: "", to: "" });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/attestations").then((r) => r.json()),
      fetch("/api/formations").then((r) => r.json()),
    ])
      .then(([atts, forms]) => {
        setAttestations(Array.isArray(atts) ? atts : []);
        setFormations(Array.isArray(forms) ? forms : []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtres dynamiques
  const filtered = attestations.filter((a) => {
    let ok = true;
    if (selectedFormation) ok = ok && a.formation?.name === selectedFormation;
    if (period.from) ok = ok && new Date(a.issuedAt) >= new Date(period.from);
    if (period.to) ok = ok && new Date(a.issuedAt) <= new Date(period.to);
    return ok;
  });

  // Attestations par mois (12 derniers mois)
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const attByMonth = months.map((m) =>
    filtered.filter((a) => {
      const d = new Date(a.issuedAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === m;
    }).length
  );

  // Répartition par type
  const typeCounts: Record<string, number> = {};
  filtered.forEach((a) => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  });
  const typeLabels = Object.keys(typeCounts);
  const typeData = Object.values(typeCounts);

  // Taux de validation
  const total = filtered.length;
  const validated = filtered.filter((a) => a.status === "VALIDATED").length;
  const validationRate = total ? Math.round((validated / total) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Statistiques</h1>
      <Card className="mb-8 p-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <Label htmlFor="formation">Filtrer par formation</Label>
            <select
              id="formation"
              className="input-style mt-1"
              value={selectedFormation}
              onChange={(e) => setSelectedFormation(e.target.value)}
            >
              <option value="">Toutes</option>
              {formations.map((f: any) => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="from">Période du</Label>
            <Input type="date" id="from" value={period.from} onChange={e => setPeriod(p => ({ ...p, from: e.target.value }))} className="input-style mt-1" />
          </div>
          <div>
            <Label htmlFor="to">au</Label>
            <Input type="date" id="to" value={period.to} onChange={e => setPeriod(p => ({ ...p, to: e.target.value }))} className="input-style mt-1" />
          </div>
          <Button variant="outline" onClick={() => { setSelectedFormation(""); setPeriod({ from: "", to: "" }); }}>Réinitialiser</Button>
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Attestations délivrées par mois</h2>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <Bar
              data={{
                labels: months,
                datasets: [{
                  label: "Attestations",
                  data: attByMonth,
                  backgroundColor: "#2563eb",
                }],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
              }}
            />
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Répartition par type</h2>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <Doughnut
              data={{
                labels: typeLabels,
                datasets: [{
                  data: typeData,
                  backgroundColor: ["#2563eb", "#16a34a", "#f59e42", "#f43f5e", "#a21caf"],
                }],
              }}
              options={{
                responsive: true,
                plugins: { legend: { position: "bottom" } },
              }}
            />
          )}
        </Card>
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-6 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold mb-4">Taux de validation</h2>
          {loading ? <Skeleton className="h-32 w-32 rounded-full" /> : (
            <div className="relative w-32 h-32">
              <Doughnut
                data={{
                  labels: ["Validées", "Non validées"],
                  datasets: [{
                    data: [validated, total - validated],
                    backgroundColor: ["#16a34a", "#f43f5e"],
                  }],
                }}
                options={{
                  cutout: "70%",
                  plugins: { legend: { display: false } },
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-green-700">{validationRate}%</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
} 