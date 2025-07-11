"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Pencil, Trash2, Loader2, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRef, useCallback } from 'react';

export default function FormationsListPage() {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const LIMIT = 20;

  // Infinite Query pour les formations
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['formations', search],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/formations?limit=${LIMIT}&offset=${pageParam}&search=${encodeURIComponent(search)}`);
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
  const formations = data ? data.pages.flat() : [];

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

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/formations/${id}`, { method: "DELETE" });
      refetch();
      setShowConfirm(null);
      toast.success("Formation supprimée avec succès !");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  // Fonction utilitaire pour exporter en CSV
  const exportCSV = () => {
    const headers = [
      "Nom",
      "Catégorie",
      "Description",
      "Compétences"
    ];
    const rows = formations.map((f) => [
      f.name,
      f.category,
      f.description,
      Array.isArray(f.skills) ? f.skills.join(", ") : ""
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "formations.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Export CSV généré !");
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center gap-3 mb-6 justify-between flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📚</span>
            <h2 className="text-2xl font-semibold">Liste des formations</h2>
          </div>
          <Button onClick={exportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Exporter CSV
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : formations.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">Aucune formation trouvée.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Nom</th>
                  <th className="px-4 py-2 text-left">Catégorie</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Compétences</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {formations.map((f: any) => (
                  <tr key={f.id} className="border-b">
                    <td className="px-4 py-2">{f.name}</td>
                    <td className="px-4 py-2">{f.category}</td>
                    <td className="px-4 py-2">{f.description}</td>
                    <td className="px-4 py-2">{Array.isArray(f.skills) ? f.skills.join(", ") : ""}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" aria-label="Détail" onClick={() => router.push(`/admin/formations/${f.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => router.push(`/admin/formations/${f.id}/edit`)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Supprimer"
                          disabled={deletingId === f.id}
                          onClick={() => setShowConfirm(f.id)}
                        >
                          {deletingId === f.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4 text-red-600" />}
                        </Button>
                      </div>
                      {showConfirm === f.id && (
                        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
                          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                            <div className="mb-4 text-lg font-semibold">Confirmer la suppression</div>
                            <div className="mb-6 text-sm text-muted-foreground">Voulez-vous vraiment supprimer cette formation ? Cette action est irréversible.</div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" onClick={() => setShowConfirm(null)}>Annuler</Button>
                              <Button variant="destructive" onClick={() => handleDelete(f.id)} disabled={deletingId === f.id}>
                                {deletingId === f.id ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : null}
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div ref={loaderRef} />
            {isFetchingNextPage && <div className="text-center py-4"><Loader2 className="animate-spin mx-auto" /></div>}
          </div>
        )}
      </Card>
    </div>
  );
} 