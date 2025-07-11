"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

export default function SignalementDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ['signalement', id],
    queryFn: async () => {
      const res = await fetch(`/api/signalement?id=${id}`);
      if (!res.ok) throw new Error('Erreur lors du chargement du signalement');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin w-8 h-8 text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <div className="flex flex-col items-center justify-center h-96 text-red-700"><AlertCircle className="w-10 h-10 mb-2" />Erreur lors du chargement du signalement</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🚨</span>
          <h2 className="text-2xl font-semibold">Détail du signalement</h2>
        </div>
        <div className="mb-4 text-sm text-gray-500">Reçu le {new Date(data.createdAt).toLocaleString()}</div>
        <div className="mb-2 font-semibold">Motif : <span className="text-red-700">{data.motif}</span></div>
        {data.codeAttestation && (
          <div className="mb-2 text-sm text-gray-700">Code attestation : {data.codeAttestation}</div>
        )}
        <div className="mb-4 text-gray-800">{data.message}</div>
        {data.email && (
          <div className="mb-2 text-xs text-gray-500">Email : {data.email}</div>
        )}
        <Button variant="outline" onClick={() => router.back()} className="mt-4">Retour</Button>
      </Card>
    </div>
  );
} 