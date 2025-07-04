"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FormationsListPage() {
  const [formations, setFormations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetch("/api/formations")
      .then((res) => res.json())
      .then((data) => setFormations(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/formations/${id}`, { method: "DELETE" });
      setFormations((prev) => prev.filter((f) => f.id !== id));
      setShowConfirm(null);
    } catch {
      alert("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">📚</span>
          <h2 className="text-2xl font-semibold">Liste des formations</h2>
        </div>
        {loading ? (
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
          </div>
        )}
      </Card>
    </div>
  );
} 