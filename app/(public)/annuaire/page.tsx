"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type Alumni = {
  id: string;
  fullName: string;
  formation: string;
  year: number;
};

export default function AnnuairePage() {
  const [search, setSearch] = useState("");
  const [formation, setFormation] = useState("");
  const [year, setYear] = useState("");

  const { data: alumni, isLoading } = useQuery({
    queryKey: ["alumni", search, formation, year],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (formation) params.append("formation", formation);
      if (year) params.append("year", year);

      const res = await fetch(`/api/public/alumni?${params}`);
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: formations } = useQuery({
    queryKey: ["formations"],
    queryFn: async () => {
      const res = await fetch("/api/formations");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const uniqueYears = Array.from(new Set<number>(alumni?.map((a: Alumni) => a.year) || []))
    .sort((a, b) => b - a);

  const handleExport = () => {
    if (!alumni || alumni.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const csv = [
      ["Nom complet", "Formation", "Année"].join(","),
      ...alumni.map((a: Alumni) =>
        [`"${a.fullName}"`, `"${a.formation}"`, a.year].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `annuaire-fsa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Annuaire exporté !");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">
            Annuaire des Anciens
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Retrouvez tous les anciens apprenants de la Ferme St André et
            restez connecté avec la communauté.
          </p>
        </div>

        <Card className="p-6 bg-white mb-8 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="search">Rechercher un ancien</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom ou prénom..."
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="formation">Formation</Label>
              <select
                id="formation"
                value={formation}
                onChange={(e) => setFormation(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Toutes</option>
                {Array.isArray(formations) &&
                  formations.map((f: any) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label htmlFor="year">Année</Label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Toutes</option>
                {uniqueYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setFormation("");
                setYear("");
              }}
            >
              Réinitialiser
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Exporter CSV
            </Button>
          </div>
        </Card>

        <Card className="p-6 bg-white max-w-6xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">
            {isLoading
              ? "Recherche en cours..."
              : alumni && alumni.length > 0
              ? `${alumni.length} ancien(s) trouvé(s)`
              : "Aucun ancien trouvé"}
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
            </div>
          ) : !alumni || alumni.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>Aucun ancien ne correspond à votre recherche.</p>
              <p className="text-sm mt-2">
                Essayez de modifier vos filtres de recherche.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alumni.map((alumnus: Alumni) => (
                <div
                  key={alumnus.id}
                  className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                      {alumnus.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">
                        {alumnus.fullName}
                      </h3>
                      <p className="text-sm text-slate-600 truncate">
                        {alumnus.formation}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Promotion {alumnus.year}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
