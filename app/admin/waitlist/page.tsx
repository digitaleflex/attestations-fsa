"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, Search, Mail, Clock, CheckCircle, XCircle, Trash2, Users, Filter
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

type WaitlistEntry = {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  status: string;
  source: string;
  createdAt: string;
};

export default function AdminWaitlistPage() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const stats = {
    total: waitlist.length,
    pending: waitlist.filter(w => w.status === "PENDING").length,
    contacted: waitlist.filter(w => w.status === "CONTACTED").length,
    converted: waitlist.filter(w => w.status === "CONVERTED").length,
  };

  const fetchWaitlist = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (search) params.set("search", search);

      const data = await apiFetch(`/api/admin/waitlist?${params}`);
      setWaitlist(data.waitlist || []);
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiFetch("/api/admin/waitlist", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      toast.success(`Statut mis à jour: ${status}`);
      fetchWaitlist();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette inscription ?")) return;
    try {
      await apiFetch(`/api/admin/waitlist?id=${id}`, { method: "DELETE" });
      toast.success("Inscription supprimée");
      fetchWaitlist();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case "CONTACTED":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Mail className="w-3 h-3 mr-1" />Contacté</Badge>;
      case "CONVERTED":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" />Converti</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejeté</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Liste d'attente Portfolio</h1>
          <p className="text-sm text-slate-500">Gérez les inscriptions à la liste d'attente</p>
        </div>
        <Button onClick={fetchWaitlist} variant="outline">
          Rafraîchir
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white">
          <p className="text-sm text-slate-500">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4 bg-white border-l-4 border-l-amber-500">
          <p className="text-sm text-slate-500">En attente</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </Card>
        <Card className="p-4 bg-white border-l-4 border-l-blue-500">
          <p className="text-sm text-slate-500">Contactés</p>
          <p className="text-2xl font-bold text-blue-600">{stats.contacted}</p>
        </Card>
        <Card className="p-4 bg-white border-l-4 border-l-emerald-500">
          <p className="text-sm text-slate-500">Convertis</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.converted}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher par email ou nom..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              className="h-10 px-3 border rounded-md"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Tous les statuts</option>
              <option value="PENDING">En attente</option>
              <option value="CONTACTED">Contacté</option>
              <option value="CONVERTED">Converti</option>
              <option value="REJECTED">Rejeté</option>
            </select>
          </div>
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : waitlist.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Aucune inscription sur la liste d'attente</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {waitlist.map((entry) => (
            <Card key={entry.id} className="p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {entry.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{entry.email}</p>
                      {entry.name && <p className="text-sm text-slate-500">{entry.name}</p>}
                    </div>
                  </div>
                  {entry.message && (
                    <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">{entry.message}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{new Date(entry.createdAt).toLocaleDateString("fr-FR")}</span>
                    <span>•</span>
                    <span>Source: {entry.source}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(entry.status)}
                  <div className="flex gap-1">
                    {entry.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(entry.id, "CONTACTED")}
                      >
                        <Mail className="w-3 h-3" />
                      </Button>
                    )}
                    {entry.status !== "CONVERTED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(entry.id, "CONVERTED")}
                      >
                        <CheckCircle className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
