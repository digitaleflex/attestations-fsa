"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, Edit, Trash2, Search, GraduationCap, Users, Calendar, Star,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

type Formation = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  skills: string[];
  createdAt: string;
  attestationsCount?: number;
};

export default function AdminFormationsPage() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    apiFetch("/api/formations")
      .then((data) => {
        setFormations(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setFormations([]);
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette formation ?")) return;
    try {
      await apiFetch(`/api/formations/${id}`, { method: "DELETE" });
      setFormations((prev) => prev.filter((f) => f.id !== id));
      toast.success("Formation supprimée !");
    } catch (err: any) {
      // toast is already handled by apiFetch
    }
  };

  // Extraire les catégories uniques
  const categories = Array.from(new Set(formations.map(f => f.category).filter(Boolean)));

  const filteredFormations = formations.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.category?.toLowerCase().includes(search.toLowerCase()) ||
      f.skills?.some(s => s.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = !categoryFilter || f.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">🎓 Formations</h1>
            <p className="text-slate-500 mt-1">Gérez le catalogue des formations</p>
          </div>
          <Link href="/admin/formations/new">
            <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700">
              <Plus className="w-4 h-4" />
              Nouvelle formation
            </Button>
          </Link>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-800">{formations.length}</p>
              </div>
              <GraduationCap className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Catégories</p>
                <p className="text-2xl font-bold text-emerald-600">{categories.length}</p>
              </div>
              <Star className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avec attestations</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formations.filter(f => f.attestationsCount && f.attestationsCount > 0).length}
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Nouvelles (30j)</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formations.filter(f => {
                    const date = new Date(f.createdAt);
                    const now = new Date();
                    const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
                    return daysDiff <= 30;
                  }).length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Filtres */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, catégorie ou compétence..."
                className="pl-10 h-10"
              />
            </div>
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toutes les catégories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          {(search || categoryFilter) && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("");
                }}
                className="gap-2 text-xs"
              >
                Réinitialiser
              </Button>
              <Badge variant="secondary">{filteredFormations.length} résultat(s)</Badge>
            </div>
          )}
        </Card>

        {/* Grille des formations */}
        {loading ? (
          <Card className="p-12 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="animate-spin w-8 h-8 text-slate-400 mb-3" />
              <p className="text-sm text-slate-500">Chargement des formations...</p>
            </div>
          </Card>
        ) : filteredFormations.length === 0 ? (
          <Card className="p-12 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center text-center">
              <GraduationCap className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-lg font-medium text-slate-600">Aucune formation trouvée</p>
              <p className="text-sm text-slate-500 mt-1">Essayez de modifier vos filtres</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFormations.map((f) => (
              <Card key={f.id} className="bg-white shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
                {/* En-tête coloré */}
                <div className="h-2 bg-gradient-to-r from-emerald-500 to-blue-600" />
                
                <div className="p-5">
                  {/* Badge catégorie */}
                  {f.category && (
                    <Badge variant="secondary" className="mb-3 bg-slate-100 text-slate-700">
                      {f.category}
                    </Badge>
                  )}

                  {/* Nom de la formation */}
                  <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2">{f.name}</h3>

                  {/* Description */}
                  {f.description && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">{f.description}</p>
                  )}

                  {/* Compétences */}
                  {f.skills && f.skills.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 mb-2">Compétences :</p>
                      <div className="flex flex-wrap gap-1">
                        {f.skills.slice(0, 5).map((skill, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {skill}
                          </Badge>
                        ))}
                        {f.skills.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{f.skills.length - 5}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Métadonnées */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{f.attestationsCount || 0} attestations</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(f.createdAt).toLocaleDateString("fr-FR")}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t">
                    <Link href={`/admin/formations/${f.id}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <Edit className="w-3 h-3" />
                        Modifier
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(f.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
