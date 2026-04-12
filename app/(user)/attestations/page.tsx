"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Download, Search, Filter, X, QrCode, Eye, Share2, ChevronRight, Clock, Lock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import dynImport from "next/dynamic";
import CertificateTemplate from "@/components/CertificateTemplate";
import { SkeletonCard, SkeletonStats } from "@/components/SkeletonLoader";

// Import dynamique de html2pdf pour éviter les erreurs SSR
const html2pdf = dynImport(() => import("html2pdf.js"), { ssr: false });
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
} from "@/components/ui/dialog";

export default function UserAttestationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedAttestation, setSelectedAttestation] = useState<any>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-attestations"],
    queryFn: async () => {
      const res = await fetch("/api/user/attestations");
      if (!res.ok) {
        if (res.status === 401) router.push("/auth");
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const handleDownload = async (att: any) => {
    setDownloading(att.code);
    toast.info(`Préparation de l'attestation ${att.code}...`);

    try {
      // Importation dynamique côté client uniquement
      const html2pdf = (await import("html2pdf.js")).default;

      // On attend un court instant pour s'assurer que le template soit bien dans le DOM si nécessaire
      // Bien qu'ici on le crée à la volée ou on utilise un ID unique
      const element = document.getElementById(`cert-template-${att.id}`);

      if (!element) {
        toast.error("Erreur technique : Template introuvable");
        return;
      }

      const opt = {
        margin: 0,
        filename: `Attestation_FSA_${att.fullName.replace(/\s+/g, '_')}_${att.code}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("✅ Attestation téléchargée !");
    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloading(null);
    }
  };

  const filteredAttestations = data?.attestations?.filter((att: any) => {
    const matchSearch = att.fullName.toLowerCase().includes(search.toLowerCase()) ||
      att.code.toLowerCase().includes(search.toLowerCase()) ||
      att.formation?.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || att.status === statusFilter;
    const matchType = typeFilter === "all" || att.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "VALIDATED": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "REJECTED": return "bg-rose-100 text-rose-700 border-rose-200";
      default: return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "VALIDATED": return "Validée";
      case "REJECTED": return "Rejetée";
      default: return "En attente";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
           <SkeletonStats />
        </div>
        <Card className="p-4 bg-white shadow-sm h-16 animate-pulse" />
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-white shadow-sm">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-bold text-slate-800">{data?.stats?.total || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-sm text-slate-500">Validées</p>
            <p className="text-2xl font-bold text-emerald-600">{data?.stats?.validated || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-amber-500">
            <p className="text-sm text-slate-500">En attente</p>
            <p className="text-2xl font-bold text-amber-600">{data?.stats?.pending || 0}</p>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-l-4 border-l-rose-500">
            <p className="text-sm text-slate-500">Rejetées</p>
            <p className="text-2xl font-bold text-rose-600">{data?.stats?.rejected || 0}</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Filtres</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, code ou formation..."
                className="pl-10 h-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="VALIDATED">Validée</SelectItem>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="REJECTED">Rejetée</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="FORMATION">Formation</SelectItem>
                <SelectItem value="STAGE">Stage</SelectItem>
                <SelectItem value="CERTIFICATION">Certification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(search || statusFilter !== "all" || typeFilter !== "all") && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
                className="gap-2 text-xs"
              >
                <X className="w-3 h-3" />
                Réinitialiser
              </Button>
              <Badge variant="secondary">{filteredAttestations?.length || 0} résultat(s)</Badge>
            </div>
          )}
        </Card>

        {/* List */}
        {!filteredAttestations || filteredAttestations.length === 0 ? (
          <Card className="p-12 bg-white shadow-sm">
            <div className="text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-600">Aucune attestation trouvée</p>
              <p className="text-sm text-slate-500 mt-1">
                Essayez de modifier vos filtres
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredAttestations.map((att: any) => (
              <Card key={att.id} className="p-5 sm:p-6 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                  {/* Informations Principales */}
                  <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-bold text-slate-800 text-lg sm:text-base leading-tight truncate max-w-[200px] sm:max-w-none" title={att.fullName}>
                          {att.fullName}
                        </h3>
                        <Badge className={`${att.isLocked ? "bg-slate-100 text-slate-500 border-slate-200" : getStatusBadgeColor(att.status)} text-[10px] sm:text-xs font-semibold px-2 py-0.5`}>
                          {att.isLocked ? (
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Délibération en cours
                            </span>
                          ) : getStatusLabel(att.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2 leading-relaxed">
                        {att.formation?.name || "-"} <span className="text-slate-300 mx-1">•</span> 
                        <span className="font-medium text-blue-600">
                          {att.type === "FORMATION" ? "Formation" : att.type === "STAGE" ? "Stage" : "Certification"}
                        </span>
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-slate-500 bg-slate-50 p-2 sm:p-0 sm:bg-transparent rounded-lg sm:rounded-none">
                        <div className="flex items-center gap-2">
                          <QrCode className="w-3 h-3 text-slate-400" />
                          <span>Code: <span className="font-mono bg-white sm:bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 sm:border-transparent">{att.isLocked ? "••••-••••-••••" : att.code}</span></span>
                        </div>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Obtenue le {new Date(att.issuedAt).toLocaleDateString("fr-FR")}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Boutons d'Action */}
                  <div className="flex items-center gap-2 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <Link href={att.isLocked ? "#" : `/attestations/${att.id}`} className="flex-1 sm:flex-none">
                      <Button
                        variant="outline"
                        size="sm"
                        onMouseEnter={() => {
                          if (att.isLocked) return;
                          queryClient.prefetchQuery({
                            queryKey: ["user-attestation", att.id],
                            queryFn: async () => {
                                const res = await fetch(`/api/attestations/${att.id}`);
                                return res.json();
                              },
                            staleTime: 5 * 60 * 1000,
                          });
                        }}
                        onClick={(e) => {
                          if (att.isLocked) {
                            e.preventDefault();
                            toast.warning("🔒 Cette attestation sera disponible après la délibération finale.");
                          }
                        }}
                        className="w-full gap-2 group shadow-sm hover:border-emerald-200 transition-all h-10 sm:h-9"
                        disabled={att.status !== "VALIDATED" || att.isLocked}
                      >
                        <Eye className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
                        <span className="group-hover:text-emerald-600 text-xs sm:text-sm whitespace-nowrap">Voir l'aperçu</span>
                      </Button>
                    </Link>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 sm:h-9 sm:w-9"
                        onClick={() => {
                          if (att.isLocked) {
                            toast.warning("🔒 Le partage sera activé après la délibération.");
                            return;
                          }
                          setSelectedAttestation(att);
                          setQrDialogOpen(true);
                        }}
                        title={att.isLocked ? "Verrouillé" : "Partager le QR Code"}
                        disabled={att.isLocked}
                      >
                        <QrCode className="w-4 h-4 text-slate-500" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className={`h-10 w-10 sm:h-9 sm:w-9 ${downloading === att.code ? 'border-emerald-200 bg-emerald-50' : ''}`}
                        onClick={() => {
                          if (att.isLocked) {
                            toast.warning("🔒 Le téléchargement sera disponible après la délibération.");
                            return;
                          }
                          handleDownload(att);
                        }}
                        disabled={att.status !== "VALIDATED" || downloading === att.code || att.isLocked}
                        title={att.isLocked ? "Verrouillé" : "Télécharger en PDF"}
                      >
                        {downloading === att.code ? (
                          <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
                        ) : (
                          <Download className="w-4 h-4 text-slate-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Code de vérification</DialogTitle>
          </DialogHeader>
          {selectedAttestation && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <QRCodeSVG
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/verifier/${selectedAttestation.code}`}
                  size={200}
                  level="H"
                />
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Code de l'attestation</p>
                <p className="font-mono text-lg font-bold text-slate-800">{selectedAttestation.code}</p>
              </div>
              <p className="text-xs text-slate-500">
                Scannez ce QR code pour vérifier l'authenticité de l'attestation
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Templates cachés pour la génération PDF */}
      <div className="hidden">
        {data?.attestations?.filter((a: any) => a.status === "VALIDATED" && !a.isLocked).map((att: any) => (
          <CertificateTemplate
            key={att.id}
            id={`cert-template-${att.id}`}
            data={{
              fullName: att.fullName,
              formationName: att.formation?.name || "Formation Saint André",
              code: att.code,
              issuedAt: att.issuedAt,
              startDate: att.startDate,
              endDate: att.endDate,
              score: att.type === "FORMATION" ? att.certificationScore : att.stageScore,
              hours: att.type === "FORMATION" ? att.certificationHours : att.stageHours,
              type: att.type,
              gender: att.gender,
              status: att.status
            }}
          />
        ))}
      </div>
    </div>
  );
}
