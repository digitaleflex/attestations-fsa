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
    const csv = [
      ["Code", "Nom complet", "Formation", "Type", "Statut", "Date émission"].join(","),
      ...attestations.map((a) =>
        [
          a.code,
          `"${a.fullName}"`,
          `"${a.formation?.name || "-"}"`,
          a.type,
          a.status,
          a.issuedAt ? new Date(a.issuedAt).toLocaleDateString("fr-FR") : "-",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attestations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé !");
  };

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
      case "REJECTED": return "Refusée";
      default: return "En attente";
    }
  };

  const filteredAttestations = attestations.filter((a) => {
    const matchSearch = a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.formation?.name.toLowerCase().includes(search.toLowerCase());
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
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exporter
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Validées</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.validated}</p>
              </div>
              <Check className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">En attente</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <Calendar className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Refusées</p>
                <p className="text-2xl font-bold text-rose-600">{stats.rejected}</p>
              </div>
              <X className="w-8 h-8 text-rose-500 opacity-50" />
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
                  <option value="REJECTED">Refusée</option>
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
          <>
            {/* Vue Grille */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAttestations.map((a) => {
              const TypeIcon = getTypeIcon(a.type);
              return (
                <Card key={a.id} className="p-5 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <TypeIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{a.type === "FORMATION" ? "Formation" : a.type === "STAGE" ? "Stage" : "Certification"}</p>
                        <p className="font-semibold text-slate-800 truncate max-w-[150px]">{a.formation?.name || "-"}</p>
                      </div>
                    </div>
                    <Badge className={getStatusBadgeColor(a.status)}>
                      {getStatusLabel(a.status)}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-700">{a.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">{isMounted && a.issuedAt ? new Date(a.issuedAt).toLocaleDateString("fr-FR") : "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-600">{a.code}</span>
                      <button
                        onClick={() => handleCopyCode(a.code, a.id)}
                        className="ml-auto p-1 rounded hover:bg-slate-200 transition-colors"
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
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <Eye className="w-3 h-3" />
                        Voir
                      </Button>
                    </Link>
                    <Link href={`/admin/attestations/${a.id}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <Edit className="w-3 h-3" />
                        Modifier
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(a.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
          <>
            {/* Vue Liste */}
            <Card className="bg-white shadow-sm overflow-hidden">
            <div className="divide-y">
              {filteredAttestations.map((a) => {
                const TypeIcon = getTypeIcon(a.type);
                return (
                  <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{a.fullName}</p>
                      <p className="text-sm text-slate-500 truncate">{a.formation?.name || "-"} • {a.type === "FORMATION" ? "Formation" : a.type === "STAGE" ? "Stage" : "Certification"}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={getStatusBadgeColor(a.status)}>
                        {getStatusLabel(a.status)}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                        <span className="text-slate-600">{a.code.slice(-8)}</span>
                        <button
                          onClick={() => handleCopyCode(a.code, a.id)}
                          className="p-1 rounded hover:bg-slate-200 transition-colors"
                        >
                          {copiedId === a.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </div>
                      <span className="text-sm text-slate-500 w-24 text-right">
                        {isMounted && a.issuedAt ? new Date(a.issuedAt).toLocaleDateString("fr-FR") : "-"}
                      </span>
                      <div className="flex gap-1">
                        <Link href={`/admin/attestations/${a.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/attestations/${a.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(a.id)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) }
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-xl">
              <Trash2 className="w-6 h-6" />
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
              Cette action est <span className="font-bold text-slate-900">irréversible</span>. 
              L&apos;attestation sera définitivement supprimée du système et ne pourra plus être vérifiée par QR Code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel 
              disabled={isDeleting}
              className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression en cours...
                </>
              ) : (
                "Supprimer définitivement"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
