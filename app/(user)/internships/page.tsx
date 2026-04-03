"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, CheckCircle, XCircle, Filter } from "lucide-react";
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

  const { data, isLoading } = useQuery({
    queryKey: ["user-internships"],
    queryFn: async () => {
      const res = await fetch("/api/user/internships");
      if (!res.ok) {
        if (res.status === 401) router.push("/admin/login");
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 bg-white shadow-sm">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-bold text-slate-800">{data?.stats?.total || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-amber-500">
            <p className="text-sm text-slate-500">En attente</p>
            <p className="text-2xl font-bold text-amber-600">{data?.stats?.pending || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-blue-500">
            <p className="text-sm text-slate-500">En revue</p>
            <p className="text-2xl font-bold text-blue-600">{data?.stats?.inReview || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-sm text-slate-500">Acceptés</p>
            <p className="text-2xl font-bold text-emerald-600">{data?.stats?.accepted || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-rose-500">
            <p className="text-sm text-slate-500">Refusés</p>
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
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all">
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
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
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
          <Card className="p-12 bg-white shadow-sm">
            <div className="text-center">
              <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-600">Aucune candidature</p>
              <p className="text-sm text-slate-500 mt-1">
                Vos candidatures de stage apparaîtront ici
              </p>
            </div>
          </Card>
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
