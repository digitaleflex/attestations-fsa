"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import "@/components/ui/input-style.css";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, Eye, Pencil, Trash2, FileDown, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRef, useCallback } from 'react';

export default function AttestationsListPage() {
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string|null>(null);
  const [showConfirm, setShowConfirm] = useState<string|null>(null);

  const LIMIT = 20;

  // Infinite Query pour les attestations
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['attestations', search],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/attestations?limit=${LIMIT}&order=desc&offset=${pageParam}&search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error('Erreur lors du chargement');
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < LIMIT) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
  });

  // Fusionner toutes les pages
  const attestations = data ? data.pages.flat() : [];

  // Infinite scroll: observer
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const option = { root: null, rootMargin: '20px', threshold: 1.0 };
    const observer = new window.IntersectionObserver(handleObserver, option);
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => { if (loaderRef.current) observer.unobserve(loaderRef.current); };
  }, [handleObserver]);

  // Suppression (inchangée)
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/attestations/${id}`, { method: 'DELETE' });
      refetch();
      setShowConfirm(null);
      toast.success("Attestation supprimée avec succès !");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  // Filtrage côté client (optionnel, si search côté API)
  // const filtered = attestations.filter(...)

  // Fonction utilitaire pour exporter en CSV
  const exportCSV = () => {
    const headers = [
      "Code",
      "Nom complet",
      "Formation",
      "Type",
      "Date émission",
      "Status"
    ];
    const rows = attestations.map((a) => [
      a.code,
      a.fullName,
      a.formation?.name || "-",
      a.type,
      a.issuedAt ? new Date(a.issuedAt).toLocaleDateString('fr-FR') : "-",
      a.status
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "attestations.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Export CSV généré !");
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copié !");
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">📄</span>
          <h2 className="text-2xl font-semibold">Liste des attestations</h2>
        </div>
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
          <Button onClick={exportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Exporter CSV
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : attestations.length === 0 ? (
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
                {attestations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs flex items-center gap-1">
                      {a.code}
                      <button type="button" onClick={() => handleCopy(a.code)} aria-label="Copier le code" className="ml-1 p-1 rounded hover:bg-gray-100">
                        <Copy className="w-4 h-4 text-gray-400 hover:text-blue-600 transition-colors" />
                      </button>
                    </TableCell>
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
                              asChild
                            >
                              <a
                                href={`/admin/attestations/${a.id}?pdf=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Télécharger PDF"
                              >
                                <FileDown className="w-4 h-4 text-green-700" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Télécharger PDF</TooltipContent>
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
            <div ref={loaderRef} />
            {isFetchingNextPage && <div className="text-center py-4"><Loader2 className="animate-spin mx-auto" /></div>}
          </div>
        )}
      </Card>
    </div>
  );
} 