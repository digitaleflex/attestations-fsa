"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function FormationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/formations/${id}`)
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((formation) => setData(formation))
      .catch(() => setError("Formation non trouvée ou erreur serveur."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Skeleton className="h-96 w-full max-w-2xl mx-auto mt-12" />;
  }
  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error || "Formation introuvable."}</AlertDescription>
        </Alert>
        <Button className="mt-6" onClick={() => router.push("/admin/dashboard")}>Retour au dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-3xl">📚</span>
          <h2 className="text-2xl font-bold">Détail de la formation</h2>
        </div>
        <div className="mb-8">
          <div className="text-xs text-muted-foreground mb-1">Nom</div>
          <div className="font-bold text-lg text-blue-700">{data.name}</div>
        </div>
        <div className="mb-8">
          <div className="text-xs text-muted-foreground mb-1">Catégorie</div>
          <div className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-sm">{data.category || '-'}</div>
        </div>
        <div className="mb-8">
          <div className="text-xs text-muted-foreground mb-1">Description</div>
          <div className="bg-blue-50 rounded-lg p-4 text-blue-900">{data.description || '-'}</div>
        </div>
        <div className="mb-8">
          <div className="text-xs text-muted-foreground mb-1">Compétences</div>
          <div className="bg-green-50 rounded-lg p-4 text-green-900">{Array.isArray(data.skills) ? data.skills.join(", ") : '-'}</div>
        </div>
        <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>Retour au dashboard</Button>
      </Card>
    </div>
  );
} 