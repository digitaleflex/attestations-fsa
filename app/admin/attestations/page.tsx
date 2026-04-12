"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  user?: {
    examSessions?: Array<{ transcriptDownloadedAt: string | null }>;
  };
};

export default function AdminAttestationsPage() {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  

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

  useEffect(() => {
    if (!isMounted) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status && status !== "all") params.append("status", status);
    if (type && type !== "all") params.append("type", type);

    apiFetch(`/api/attestations?${params.toString()}`)
      .then((data) => {
        setAttestations(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setAttestations([]);
        setLoading(false);
      });
  }, [search, status, type, isMounted]);

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success("Code copié !");
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
      toast.success("Attestation supprimée !");
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

  const filteredAttestations = attestations.filter((a) => {
    const searchLower = (search || "").toLowerCase();
    const fullName = (a.fullName || "").toLowerCase();
    const code = (a.code || "").toLowerCase();
    const formationName = (a.formation?.name || "").toLowerCase();
    
    const matchSearch = fullName.includes(searchLower) ||
      code.includes(searchLower) ||
      formationName.includes(searchLower);
      
    const matchStatus = !status || status === "all" || a.status === status;
    const matchType = !type || type === "all" || a.type === type;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">📜 Attestations</h1>
            <p className="text-slate-500 mt-1">Gérez toutes les attestations délivrées</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <Download className="w-4 h-4" />
              Exporter Excel
            </Button>
            <Link href="/admin/attestations/new">
              <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700">
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
          <Card className="p-4 bg-white shadow-sm border-l-4 border-indigo-500 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Award className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Relevés vus</p>
                <p className="text-xl font-black text-indigo-600">
                  {attestations.filter(a => a.user?.examSessions?.[0]?.transcriptDownloadedAt).length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filtres */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Filtres</span>
          </div>
          {isMounted && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, code ou formation..."
                    className="pl-10 h-10"
                  />
                </div>
              </div>
              <div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les statuts</option>
                  <option value="PENDING">En attente</option>
                  <option value="VALIDATED">Validée</option>
                  <option value="REJECTED">Révoquée</option>
                </select>
              </div>
              <div>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setType("");
                }}
                className="gap-2 text-xs"
              >
                <X className="w-3 h-3" />
                Réinitialiser les filtres
              </Button>
              <Badge variant="secondary">{filteredAttestations.length} résultat(s)</Badge>
            </div>
          )}
        </Card>

        {/* Toggle Vue */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="text-xs"
          >
            Grille
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="text-xs"
          >
            Liste
          </Button>
        </div>

        {/* Contenu */}
        {loading ? (
          <Card className="p-12 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="animate-spin w-8 h-8 text-slate-400 mb-3" />
              <p className="text-sm text-slate-500">Chargement des attestations...</p>
            </div>
          </Card>
        ) : filteredAttestations.length === 0 ? (
          <Card className="p-12 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-lg font-medium text-slate-600">Aucune attestation trouvée</p>
              <p className="text-sm text-slate-500 mt-1">Essayez de modifier vos filtres</p>
            </div>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAttestations.map((a) => {
              const TypeIcon = getTypeIcon(a.type);
              const isDownloaded = !!a.user?.examSessions?.[0]?.transcriptDownloadedAt;
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
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-bold">{a.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{isMounted && a.issuedAt ? new Date(a.issuedAt).toLocaleDateString("fr-FR") : "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 border border-slate-100 px-2 py-1.5 rounded-lg group">
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-600 flex-1 truncate">{a.code}</span>
                      <button
                        onClick={() => handleCopyCode(a.code, a.id)}
                        className="p-1 rounded hover:bg-white hover:shadow-sm transition-all"
                      >
                        {copiedId === a.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
                    <Link href={`/admin/attestations/${a.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-2 text-xs h-9">
                        <Eye className="w-3 h-3" />
                        Voir
                      </Button>
                    </Link>
                    <Link href={`/admin/attestations/${a.id}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-2 text-xs h-9">
                        <Edit className="w-3 h-3" />
                        Modif.
                      </Button>
                    </Link>
                    <Link href={`/transcript?userId=${a.userId}&download=true`} target="_blank">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!a.userId}
                        className={cn(
                          "h-9 w-10 p-0 relative flex items-center justify-center transition-all",
                          isDownloaded ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-blue-600'
                        )}
                        title={isDownloaded ? "Déjà téléchargé" : "Télécharger le relevé"}
                      >
                        <Download className="w-4 h-4" />
                        {isDownloaded && (
                          <div className="absolute -top-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm">
                            <Check className="w-2 h-2" />
                          </div>
                        )}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(a.id)}
                      className="h-9 w-10 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-100"
                    >
                      <Trash2 className="w-4 h-4" />
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
                const isDownloaded = !!a.user?.examSessions?.[0]?.transcriptDownloadedAt;
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/admin/attestations/${a.id}/edit`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/transcript?userId=${a.userId}&download=true`} target="_blank">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!a.userId}
                              className={cn("h-8 w-8 relative", isDownloaded ? 'text-indigo-600' : 'text-slate-400 hover:text-blue-600')}
                              title={isDownloaded ? "Déjà téléchargé" : "Télécharger le relevé"}
                            >
                               <Download className="w-4 h-4" />
                               {isDownloaded && <Check className="absolute -top-0.5 -right-0.5 w-2 h-2 text-indigo-500 font-bold" />}
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(a.id)}
                            className="text-slate-300 hover:text-rose-600 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
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
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-black text-xl">
              <Trash2 className="w-6 h-6" />
              CONFIRMER LA SUPPRESSION
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed font-medium">
              Cette action est <span className="font-black text-slate-900 border-b-2 border-rose-500">irréversible</span>.
              L&apos;attestation sera définitivement supprimée et ne pourra plus être vérifiée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel
              disabled={isDeleting}
              className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl"
            >
              ANNULER
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200 font-bold rounded-xl"
              disabled={isDeleting}
            >
              {isDeleting ? "SUPPRESSION..." : "OUI, SUPPRIMER"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Removed duplicated template rendering */}
    </div>
  );
}
