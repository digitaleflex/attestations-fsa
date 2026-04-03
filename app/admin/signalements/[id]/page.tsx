"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Mail, FileText, Calendar, CheckCircle, Clock, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";

type Report = {
  id: string;
  codeAttestation: string | null;
  motif: string;
  message: string;
  email: string | null;
  createdAt: string;
  status: string;
};

export default function SignalementDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState("");

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const res = await fetch(`/api/signalement`);
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      const found = Array.isArray(data) ? data.find((r: Report) => r.id === id) : null;
      if (!found) throw new Error("Signalement non trouvé");
      return found;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (report) {
      setStatus(report.status);
    }
  }, [report]);

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    try {
      const res = await fetch(`/api/signalement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour");
      toast.success("✅ Statut mis à jour !");
    } catch (err: any) {
      toast.error(err.message || "Erreur inconnue");
      setStatus(report?.status || "");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce signalement ?")) return;
    try {
      const res = await fetch(`/api/signalement`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      toast.success("Signalement supprimé !");
      router.push("/admin/signalements");
    } catch (err: any) {
      toast.error(err.message || "Erreur inconnue");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 bg-white">
            <h2 className="text-xl font-semibold text-rose-600 mb-2">
              Signalement non trouvé
            </h2>
            <p className="text-slate-500 mb-4">
              Ce signalement n'existe pas ou a été supprimé.
            </p>
            <Link href="/admin/signalements">
              <Button>← Retour à la liste</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

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

  const StatusIcon = getStatusIcon(status);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/signalements">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">🚨 Détail du signalement</h1>
              <p className="text-sm text-slate-500">
                {new Date(report.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Carte principale */}
        <Card className="p-8 bg-white shadow-lg">
          {/* En-tête avec statut */}
          <div className="flex items-start justify-between mb-6 pb-6 border-b">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{report.motif}</h2>
                <p className="text-sm text-slate-500">Signalé le {new Date(report.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
            </div>
            <Badge className={getStatusBadgeColor(status)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {getStatusLabel(status)}
            </Badge>
          </div>

          {/* Contenu du signalement */}
          <div className="space-y-6 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Message
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-slate-700 whitespace-pre-wrap">{report.message}</p>
              </div>
            </div>

            {report.codeAttestation && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Code de l'attestation
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="font-mono text-slate-800">{report.codeAttestation}</p>
                </div>
              </div>
            )}

            {report.email && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  Email du déclarant
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-slate-800">{report.email}</p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                Date et heure
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-slate-800">
                  {new Date(report.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">⚡ Actions</h3>
            
            {/* Changement de statut */}
            <div className="mb-4">
              <Label htmlFor="status" className="text-sm font-semibold text-slate-700">
                Modifier le statut
              </Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={status === "NOUVEAU" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange("NOUVEAU")}
                  className={status === "NOUVEAU" ? "bg-amber-600 hover:bg-amber-700" : ""}
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Nouveau
                </Button>
                <Button
                  variant={status === "EN_COURS" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange("EN_COURS")}
                  className={status === "EN_COURS" ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  En cours
                </Button>
                <Button
                  variant={status === "TRAITE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange("TRAITE")}
                  className={status === "TRAITE" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Traité
                </Button>
              </div>
            </div>

            {/* Suppression */}
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer le signalement
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
