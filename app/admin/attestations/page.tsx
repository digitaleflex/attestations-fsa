"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import {
  Loader2, Plus, Download, Eye, Edit, Trash2, Copy, Check, Search, Filter, X,
  FileText, GraduationCap, Award, Calendar, User
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Attestation = {
  id: string;
  code: string;
  fullName: string;
  formation: { name: string };
  type: string;
  status: string;
  issuedAt: string;
  userId?: string;
  user?: Record<string, never>;
};

export default function AdminAttestationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // État initial lu depuis l'URL (lien partagé / Back-Forward)
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [status, setStatus] = useState(() => {
    const st = searchParams.get("status") || "";
    return ["PENDING", "VALIDATED", "REJECTED"].includes(st) ? st : "";
  });
  const [type, setType] = useState(() => {
    const ty = searchParams.get("type") || "";
    return ["FORMATION", "STAGE", "CERTIFICATION"].includes(ty) ? ty : "";
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    const vw = searchParams.get("view");
    return vw === "list" ? "list" : "grid";
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const debouncedSearch = useDebounce(search, 500);
  

  // Statistiques
  const stats = {
    total: attestations.length,
    validated: attestations.filter(a => a.status === "VALIDATED").length,
    pending: attestations.filter(a => a.status === "PENDING").length,
    rejected: attestations.filter(a => a.status === "REJECTED").length,
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const writeUrl = useCallback(
    (next: { q: string; status: string; type: string; view: string }) => {
      const params = new URLSearchParams();
      if (next.q) params.set("q", next.q);
      if (next.status) params.set("status", next.status);
      if (next.type) params.set("type", next.type);
      if (next.view && next.view !== "grid") params.set("view", next.view);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const fetchAttestations = useCallback(
    async (q: string, st: string, ty: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.append("search", q);
        if (st) params.append("status", st);
        if (ty) params.append("type", ty);

        const data = await apiFetch(`/api/attestations?${params.toString()}`);
        setAttestations(Array.isArray(data) ? data : []);
        setLoadError(false);
      } catch (err) {
        console.error("[admin/attestations] chargement impossible:", err);
        setAttestations([]);
        setLoadError(true);
        toast.error("Impossible de charger les attestations.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Recherche debouncée + selects → URL (partageable) + rechargement serveur
  useEffect(() => {
    if (!isMounted) return;
    writeUrl({ q: debouncedSearch, status, type, view: viewMode });
    fetchAttestations(debouncedSearch, status, type);
  }, [debouncedSearch, status, type, viewMode, isMounted, writeUrl, fetchAttestations]);

  // Back/Forward ou lien partagé → les contrôles suivent l'URL
  // (sauf la frappe en cours dans la recherche)
  useEffect(() => {
    if (document.activeElement?.id !== "attestations-search") {
      const q = searchParams.get("q") || "";
      if (q !== search) setSearch(q);
    }
    const st = searchParams.get("status") || "";
    if (st !== status) setStatus(["PENDING", "VALIDATED", "REJECTED"].includes(st) ? st : "");
    const ty = searchParams.get("type") || "";
    if (ty !== type) setType(["FORMATION", "STAGE", "CERTIFICATION"].includes(ty) ? ty : "");
    const vw = searchParams.get("view");
    if ((vw === "grid" || vw === "list") && vw !== viewMode) setViewMode(vw);
  }, [searchParams]);

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success("Code copié");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Impossible de copier le code");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/attestations/${deleteId}`, { method: "DELETE" });
      setAttestations((prev) => prev.filter((a) => a.id !== deleteId));
      toast.success("Attestation supprimée");
    } catch {
      // Error handled by apiFetch
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleExport = () => {
    window.open("/api/admin/attestations/export", "_blank");
    toast.success("Préparation de l'exportation complète...");
  };

  // handleDownloadTranscript was removed to use shared logic

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "FORMATION": return GraduationCap;
      case "STAGE": return FileText;
      case "CERTIFICATION": return Award;
      default: return FileText;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "VALIDATED": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "REJECTED": return "bg-rose-100 text-rose-700 border-rose-200";
      default: return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "VALIDATED": return "Validée";
      case "REJECTED": return "Révoquée";
      default: return "En attente";
    }
  };

  // Le filtrage est effectué côté serveur (search/status/type) — source unique
  const filteredAttestations = attestations;

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">📜 Attestations</h1>
            <p className="text-slate-500 mt-1">Gérez toutes les attestations délivrées</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button onClick={handleExport} variant="outline" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 flex-1 sm:flex-none">
              <Download className="w-4 h-4" />
              Exporter Excel
            </Button>
            <Link href="/admin/attestations/new" className="flex-1 sm:flex-none">
              <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Nouvelle
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total</p>
                <p className="text-xl font-black text-slate-900">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-emerald-500 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Validées</p>
                <p className="text-xl font-black text-emerald-600">{stats.validated}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-amber-500 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Loader2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">En attente</p>
                <p className="text-xl font-black text-amber-600">{stats.pending}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-rose-500 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 rounded-lg">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Rejetées</p>
                <p className="text-xl font-black text-rose-600">{stats.rejected}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filtres */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span id="attestations-filters-title" className="text-sm font-semibold text-slate-700">Filtres</span>
          </div>
          {isMounted && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4" role="group" aria-labelledby="attestations-filters-title">
              <div className="md:col-span-2">
                <Label htmlFor="attestations-search">Rechercher</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                  <Input
                    id="attestations-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, code ou formation..."
                    autoComplete="off"
                    className="pl-10 min-h-[44px]"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="attestations-filter-status">Statut</Label>
                <select
                  id="attestations-filter-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full mt-1 min-h-[44px] px-3 rounded-2xl border-2 border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="">Tous les statuts</option>
                  <option value="PENDING">En attente</option>
                  <option value="VALIDATED">Validée</option>
                  <option value="REJECTED">Révoquée</option>
                </select>
              </div>
              <div>
                <Label htmlFor="attestations-filter-type">Type</Label>
                <select
                  id="attestations-filter-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full mt-1 min-h-[44px] px-3 rounded-2xl border-2 border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="">Tous les types</option>
                  <option value="FORMATION">Formation</option>
                  <option value="STAGE">Stage</option>
                  <option value="CERTIFICATION">Certification</option>
                </select>
              </div>
            </div>
          )}
          {(search || status || type) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setType("");
                }}
                className="gap-2 text-xs min-h-[44px]"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                Réinitialiser les filtres
              </Button>
              <Badge variant="secondary" aria-live="polite">{filteredAttestations.length} résultat(s)</Badge>
            </div>
          )}
        </Card>

        {/* Toggle Vue */}
        <div className="flex items-center gap-2" role="group" aria-label="Mode d'affichage">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            className="text-xs min-h-[44px]"
          >
            Grille
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className="text-xs min-h-[44px]"
          >
            Liste
          </Button>
        </div>

        {/* Contenu */}
        {loading && attestations.length === 0 ? (
          <Card className="p-6 sm:p-12 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center" role="status" aria-label="Chargement des attestations">
              <Loader2 className="animate-spin w-8 h-8 text-slate-500 mb-3" aria-hidden="true" />
              <p className="text-sm text-slate-500">Chargement des attestations...</p>
            </div>
          </Card>
        ) : loadError && attestations.length === 0 ? (
          <Card className="bg-white shadow-sm">
            <ErrorState
              title="Impossible de charger les attestations"
              description="Une erreur est survenue lors du chargement des données."
              onRetry={() => fetchAttestations(debouncedSearch, status, type)}
            />
          </Card>
        ) : filteredAttestations.length === 0 ? (
          <Card className="bg-white shadow-sm">
            <EmptyState
              title={(search || status || type) ? "Aucune attestation trouvée" : "Aucune attestation"}
              description={(search || status || type)
                ? "Nous n'avons trouvé aucune attestation correspondant à vos critères."
                : "Aucune attestation délivrée pour le moment."}
              primaryAction={(search || status || type)
                ? { label: "Réinitialiser les filtres", onClick: () => { setSearch(""); setStatus(""); setType(""); } }
                : { label: "Nouvelle attestation", onClick: () => router.push("/admin/attestations/new") }}
            />
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAttestations.map((a) => {
              const TypeIcon = getTypeIcon(a.type);
              return (
                <Card key={a.id} className="p-5 bg-white shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-100">
                        <TypeIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">{a.type}</p>
                        <p className="font-bold text-slate-800 truncate max-w-[150px]">{a.formation?.name || "-"}</p>
                      </div>
                    </div>
                    <Badge className={getStatusBadgeColor(a.status)}>
                      {getStatusLabel(a.status)}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <User className="w-4 h-4 text-slate-500" aria-hidden="true" />
                      <span className="font-bold">{a.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="w-4 h-4 text-slate-500" aria-hidden="true" />
                      <span>{isMounted && a.issuedAt ? new Date(a.issuedAt).toLocaleDateString("fr-FR") : "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 border border-slate-100 px-2 py-1.5 rounded-lg group">
                      <Copy className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      <span className="text-slate-600 flex-1 truncate">{a.code}</span>
                      <button
                        onClick={() => handleCopyCode(a.code, a.id)}
                        aria-label={`Copier le code ${a.code}`}
                        className="flex h-11 w-11 -my-2 items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {copiedId === a.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-500" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
                    <Link href={`/admin/attestations/${a.id}`} className="flex-1">
                      <Button variant="outline" className="w-full gap-2 text-xs min-h-[44px]">
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        Voir
                      </Button>
                    </Link>
                    <Link href={`/admin/attestations/${a.id}/edit`} className="flex-1">
                      <Button variant="outline" className="w-full gap-2 text-xs min-h-[44px]">
                        <Edit className="w-3 h-3" aria-hidden="true" />
                        Modif.
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteId(a.id)}
                      aria-label={`Supprimer l'attestation de ${a.fullName}`}
                      className="h-11 w-11 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-white shadow-sm overflow-hidden border border-slate-100 rounded-xl">
            <div className="divide-y divide-slate-50">
              {filteredAttestations.map((a) => {
                const TypeIcon = getTypeIcon(a.type);
                return (
                  <div key={a.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/50 transition-colors group">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <TypeIcon className="w-5 h-5 text-slate-500 group-hover:text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate">{a.fullName}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {a.formation?.name || "-"} • <span className="uppercase font-black text-[10px] tracking-widest">{a.type}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 md:gap-6">
                      <div className="flex items-center gap-3">
                        <Badge className={cn("text-[10px] font-black px-2.5 py-0.5 uppercase tracking-tighter", getStatusBadgeColor(a.status))}>
                          {getStatusLabel(a.status)}
                        </Badge>
                        <div className="flex items-center gap-2 text-[10px] font-mono bg-slate-100 px-2 py-1 rounded-md text-slate-500">
                          <span>{a.code.slice(-10)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <Link href={`/admin/attestations/${a.id}`}>
                            <Button variant="ghost" aria-label={`Voir ${a.fullName}`} className="h-11 w-11 text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                              <Eye className="w-4 h-4" aria-hidden="true" />
                            </Button>
                          </Link>
                           <Link href={`/admin/attestations/${a.id}/edit`}>
                            <Button variant="ghost" aria-label={`Modifier ${a.fullName}`} className="h-11 w-11 text-slate-500 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                              <Edit className="w-4 h-4" aria-hidden="true" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            onClick={() => setDeleteId(a.id)}
                            aria-label={`Supprimer l'attestation de ${a.fullName}`}
                            className="text-slate-500 hover:text-rose-600 h-11 w-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-xl">
              <Trash2 className="w-6 h-6" aria-hidden="true" />
              Supprimer cette attestation ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed font-medium">
              Cette action est <span className="font-bold text-slate-900 border-b-2 border-rose-500">irréversible</span>.
              L&apos;attestation sera définitivement supprimée et ne pourra plus être vérifiée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel
              disabled={isDeleting}
              className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl min-h-[44px]"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200 font-bold rounded-xl min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
              disabled={isDeleting}
            >
              {isDeleting ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Removed duplicated template rendering */}
    </div>
  );
}
