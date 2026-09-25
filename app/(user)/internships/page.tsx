"use client";

export const dynamic = 'force-dynamic';

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, CheckCircle, XCircle, Filter } from "lucide-react";
import {
  CandidateEmptyState,
  CandidateErrorState,
  CandidateLoading,
} from "@/components/CandidateStates";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";

export default function UserInternshipsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    university: "",
    level: "",
    position: "",
    message: "",
    cvUrl: ""
  });

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["user-internships"],
    queryFn: async () => {
      const res = await fetch("/api/user/internships");
      if (!res.ok) {
        if (res.status === 401) router.push("/auth");
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const submitMutation = useMutation({
    mutationFn: async (newApp: any) => {
      const res = await fetch("/api/user/internships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApp),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-internships"] });
      toast.success("✅ Candidature soumise !");
      setIsDialogOpen(false);
      setFormData({ university: "", level: "", position: "", message: "", cvUrl: "" });
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate(formData);
  };

  const filteredApplications = data?.applications?.filter((app: any) => {
    if (statusFilter === "all") return true;
    return app.status === statusFilter;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACCEPTED": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "REJECTED": return "bg-rose-100 text-rose-700 border-rose-200";
      case "REVIEWING": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACCEPTED": return "Accepté";
      case "REJECTED": return "Refusé";
      case "REVIEWING": return "En revue";
      default: return "En attente";
    }
  };

  // Titre de page réutilisé dans les états de chargement et d'erreur : la
  // candidate garde toujours son repère, même quand la liste ne s'affiche pas.
  const pageTitle = (
    <header>
      <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
        Stages & Projets
      </h1>
      <p className="text-slate-600 text-sm font-medium mt-1">
        Suivez vos candidatures de stage et l&apos;avancement de leur traitement.
      </p>
    </header>
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        {pageTitle}
        <CandidateLoading
          label="Chargement de vos candidatures de stage…"
          className="py-16 justify-center"
        />
      </div>
    );
  }

  // Erreur réseau / serveur : ce n'est PAS « aucune candidature ». On l'annonce
  // explicitement et on propose de relancer la requête.
  if (isError) {
    return (
      <div className="space-y-8">
        {pageTitle}
        <CandidateErrorState
          onRetry={() => {
            void refetch();
          }}
          isRetrying={isFetching}
          title="Impossible de charger vos candidatures"
          description="Vérifiez votre connexion internet puis relancez le chargement. Si le problème persiste, contactez le bureau de la Ferme Saint André."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
        {pageTitle}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 bg-white shadow-sm">
            <p className="text-sm text-slate-600">Total</p>
            <p className="text-2xl font-bold text-slate-800">{data?.stats?.total || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-amber-500">
            <p className="text-sm text-slate-600">En attente</p>
            <p className="text-2xl font-bold text-amber-600">{data?.stats?.pending || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
            <p className="text-sm text-slate-600">En revue</p>
            <p className="text-2xl font-bold text-blue-600">{data?.stats?.inReview || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-sm text-slate-600">Acceptés</p>
            <p className="text-2xl font-bold text-emerald-600">{data?.stats?.accepted || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-rose-500">
            <p className="text-sm text-slate-600">Refusés</p>
            <p className="text-2xl font-bold text-rose-600">{data?.stats?.rejected || 0}</p>
          </Card>
        </div>

        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Filtrer par statut</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-10">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="REVIEWING">En revue</SelectItem>
                <SelectItem value="ACCEPTED">Accepté</SelectItem>
                <SelectItem value="REJECTED">Refusé</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-brand hover:bg-brand-dark shadow-md transition-all">
                  <PlusCircle className="w-4 h-4" />
                  Nouvelle demande
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-slate-800">Postuler pour un stage</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="univ">Université / École</Label>
                      <Input
                        id="univ"
                        placeholder="Ex: UAC, ENEAM..."
                        value={formData.university}
                        onChange={(e) => setFormData({...formData, university: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level">Niveau d'études</Label>
                      <Input
                        id="level"
                        placeholder="Ex: Licence 3, Master 1..."
                        value={formData.level}
                        onChange={(e) => setFormData({...formData, level: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pos">Poste souhaité <span className="text-rose-500">*</span></Label>
                    <Input
                      id="pos"
                      placeholder="Ex: Stagiaire Comptable, Assistant de Direction..."
                      required
                      value={formData.position}
                      onChange={(e) => setFormData({...formData, position: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cv">Lien vers CV (URL optionnelle)</Label>
                    <Input
                      id="cv"
                      type="url"
                      placeholder="https://mon-cv.pdf"
                      value={formData.cvUrl}
                      onChange={(e) => setFormData({...formData, cvUrl: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="msg">Motivation / Message</Label>
                    <Textarea
                      id="msg"
                      placeholder="Dites-nous pourquoi vous souhaitez rejoindre la Ferme FSA..."
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      className="w-full bg-brand hover:bg-brand-dark"
                      disabled={submitMutation.isPending}
                    >
                      {submitMutation.isPending ? "Envoi..." : "Soumettre ma candidature"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </Card>

        {!filteredApplications || filteredApplications.length === 0 ? (
          statusFilter === "all" ? (
            <CandidateEmptyState
              icon={
                <Briefcase className="h-8 w-8 text-slate-500" aria-hidden="true" />
              }
              title="Aucune candidature envoyée"
              description="Vos candidatures de stage apparaîtront ici avec leur statut : en attente, en revue, acceptée ou refusée."
              primaryAction={{
                label: "Postuler pour un stage",
                onClick: () => setIsDialogOpen(true),
              }}
            />
          ) : (
            <CandidateEmptyState
              icon={
                <Filter className="h-8 w-8 text-slate-500" aria-hidden="true" />
              }
              title="Aucune candidature avec ce statut"
              description={`Le filtre « ${getStatusLabel(statusFilter)} » ne correspond à aucune de vos candidatures.`}
              primaryAction={{
                label: "Réinitialiser le filtre",
                onClick: () => setStatusFilter("all"),
              }}
            />
          )
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredApplications.map((app: any) => (
              <Card key={app.id} className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{app.position}</h3>
                      <p className="text-sm text-slate-500">
                        Soumise le {new Date(app.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusBadgeColor(app.status)}>
                    {getStatusLabel(app.status)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
