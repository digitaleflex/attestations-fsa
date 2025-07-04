"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import "@/components/ui/input-style.css";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, Eye, Pencil, Trash2 } from "lucide-react";

export default function AttestationsListPage() {
  const [attestations, setAttestations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string|null>(null);
  const [showConfirm, setShowConfirm] = useState<string|null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/attestations/${id}`, { method: 'DELETE' });
      setAttestations((prev) => prev.filter((a) => a.id !== id));
      setShowConfirm(null);
    } catch {
      alert("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetch("/api/attestations")
      .then((res) => res.json())
      .then((data) => setAttestations(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = attestations.filter((a) => {
    const q = search.toLowerCase();
    if (q.length === 5) {
      // Recherche sur le hash final du code
      return a.code?.toLowerCase().endsWith('-' + q);
    }
    // Recherche globale classique
    return (
      a.fullName?.toLowerCase().includes(q) ||
      a.code?.toLowerCase().includes(q) ||
      a.formation?.name?.toLowerCase().includes(q) ||
      a.type?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">📄</span>
          <h2 className="text-2xl font-semibold">Liste des attestations</h2>
        </div>
        <div className="mb-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  className="input-style"
                  placeholder="Rechercher par nom, code, formation... ou tapez les 5 derniers caractères du code"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </TooltipTrigger>
              <TooltipContent>
                Tapez un nom, un code, une formation, ou <b>les 5 derniers caractères</b> du code d'attestation pour une recherche rapide.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">Aucune attestation trouvée.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Formation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date émission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.code}</TableCell>
                    <TableCell>{a.fullName}</TableCell>
                    <TableCell>{a.formation?.name || "-"}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell>{a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>{a.status}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" asChild>
                              <a href={`/admin/attestations/${a.id}`} aria-label="Détail">
                                <Eye className="w-4 h-4" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Voir le détail</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" asChild>
                              <a href={`/admin/attestations/${a.id}/edit`} aria-label="Modifier">
                                <Pencil className="w-4 h-4" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Modifier</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deletingId === a.id}
                              onClick={() => setShowConfirm(a.id)}
                              aria-label="Supprimer"
                            >
                              {deletingId === a.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4 text-red-600" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Supprimer</TooltipContent>
                        </Tooltip>
                      </div>
                      {/* Dialogue de confirmation */}
                      {showConfirm === a.id && (
                        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
                          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                            <div className="mb-4 text-lg font-semibold">Confirmer la suppression</div>
                            <div className="mb-6 text-sm text-muted-foreground">Voulez-vous vraiment supprimer cette attestation ? Cette action est irréversible.</div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" onClick={() => setShowConfirm(null)}>Annuler</Button>
                              <Button variant="destructive" onClick={() => handleDelete(a.id)} disabled={deletingId === a.id}>
                                {deletingId === a.id ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : null}
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </TableCell>
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