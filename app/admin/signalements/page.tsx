"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Eye, Trash2, AlertTriangle, Search, Filter, X, Mail, FileText, CheckCircle, Clock, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
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
import { apiFetch } from "@/lib/api-client";

type Report = {
  id: string;
  codeAttestation: string | null;
  motif: string;
  message: string;
  email: string | null;
  createdAt: string;
  status: string;
};

export default function AdminSignalementsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Statistiques
  const stats = {
    total: reports.length,
    nouveau: reports.filter(r => r.status === "NOUVEAU").length,
    enCours: reports.filter(r => r.status === "EN_COURS").length,
    traite: reports.filter(r => r.status === "TRAITE").length,
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/signalement");
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!reportToDelete) return;

    setDeleteLoading(true);
    try {
      await apiFetch(`/api/signalement?id=${reportToDelete}`, {
        method: "DELETE"
      });
      setReports((prev) => prev.filter((r) => r.id !== reportToDelete));
      toast.success("✅ Signalement supprimé avec succès !");
      setReportToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchSearch =
      r.codeAttestation?.toLowerCase().includes(search.toLowerCase()) ||
      r.motif.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.message.toLowerCase().includes(search.toLowerCase());
    const matchStatus = (status && status !== "all") ? r.status === status : true;
    return matchSearch && matchStatus;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "TRAITE":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "EN_COURS":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "TRAITE":
        return "Traité";
      case "EN_COURS":
        return "En cours";
      default:
        return "Nouveau";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "TRAITE":
        return CheckCircle;
      case "EN_COURS":
        return Clock;
      default:
        return AlertCircle;
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">🚨 Signalements</h1>
            <p className="text-slate-500 mt-1">Gérez les signalements reçus</p>
          </div>
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
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-slate-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-slate-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Nouveaux</p>
                <p className="text-2xl font-bold text-amber-600">{stats.nouveau}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">En cours</p>
                <p className="text-2xl font-bold text-blue-600">{stats.enCours}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Traité</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.traite}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Filtres */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Filtres</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par code, motif, email ou message..."
                className="pl-10 h-10"
              />
            </div>
            <div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="NOUVEAU">Nouveau</option>
                <option value="EN_COURS">En cours</option>
                <option value="TRAITE">Traité</option>
              </select>
            </div>
          </div>
          {(search || status) && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
                className="gap-2 text-xs"
              >
                <X className="w-3 h-3" />
                Réinitialiser
              </Button>
              <Badge variant="secondary">{filteredReports.length} résultat(s)</Badge>
            </div>
          )}
        </Card>

        {/* Contenu */}
        {loading ? (
          <Card className="p-12 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="animate-spin w-8 h-8 text-slate-400 mb-3" />
              <p className="text-sm text-slate-500">Chargement des signalements...</p>
            </div>
          </Card>
        ) : filteredReports.length === 0 ? (
          <Card className="p-12 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-lg font-medium text-slate-600">Aucun signalement trouvé</p>
              <p className="text-sm text-slate-500 mt-1">Essayez de modifier vos filtres</p>
            </div>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((r) => {
              const StatusIcon = getStatusIcon(r.status);
              return (
                <Card key={r.id} className="p-5 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Signalement</p>
                        <p className="font-semibold text-slate-800">{r.motif}</p>
                      </div>
                    </div>
                    <Badge className={getStatusBadgeColor(r.status)}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {getStatusLabel(r.status)}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    {r.codeAttestation && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-slate-600">{r.codeAttestation}</span>
                      </div>
                    )}
                    {r.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600">{r.email}</span>
                      </div>
                    )}
                    <p className="text-sm text-slate-600 line-clamp-3 bg-slate-50 p-2 rounded">
                      {r.message}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString("fr-FR", {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
                    <Link href={`/admin/signalements/${r.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <Eye className="w-3 h-3" />
                        Voir
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReportToDelete(r.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <>
            {/* Vue Liste */}
            <Card className="bg-white shadow-sm overflow-hidden">
              <div className="divide-y">
                {filteredReports.map((r) => {
                  const StatusIcon = getStatusIcon(r.status);
                  return (
                    <div key={r.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{r.motif}</p>
                        <p className="text-sm text-slate-500 truncate">{r.message}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {r.codeAttestation && (
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            {r.codeAttestation.slice(-8)}
                          </span>
                        )}
                        <Badge className={getStatusBadgeColor(r.status)}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {getStatusLabel(r.status)}
                        </Badge>
                        <span className="text-sm text-slate-500 w-24 text-right">
                          {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                        <div className="flex gap-1">
                          <Link href={`/admin/signalements/${r.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReportToDelete(r.id)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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

      {/* Modern Confirmation Dialog */}
      <AlertDialog open={!!reportToDelete} onOpenChange={() => setReportToDelete(null)}>
        <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl max-w-[450px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-xl">
              <Trash2 className="w-6 h-6" />
              Supprimer le signalement ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
              Êtes-vous sûr de vouloir supprimer ce signalement ?
              <span className="block mt-2 font-bold text-rose-600 underline underline-offset-4">Cette action est définitive et irréversible.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel
              disabled={deleteLoading}
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 gap-2 px-6"
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Confirmer la suppression
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
