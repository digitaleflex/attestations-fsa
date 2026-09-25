"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Download, Search, Filter, X, QrCode, Eye, 
  Share2, ChevronRight, Clock, Lock, AlertCircle, Send, 
  CheckCircle, ClipboardList, Loader2, Award, FileSpreadsheet, BarChart3
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import dynImport from "next/dynamic";
import CertificateTemplate from "@/components/CertificateTemplate";
import { SkeletonCard, SkeletonStats } from "@/components/SkeletonLoader";
import {
  CandidateEmptyState,
  CandidateErrorState,
} from "@/components/CandidateStates";

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
  const [reportLostOpen, setReportLostOpen] = useState(false);
  const [reportingAtt, setReportingAtt] = useState<any>(null);
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
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
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById(`cert-template-${att.id}`);

      if (!element) {
        toast.error("Erreur technique : Template introuvable");
        return;
      }

      const opt = {
        margin: 0,
        filename: `Attestation_FSA_${att.fullName.replace(/\s+/g, '_')}_${att.code}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("✅ Attestation téléchargée !");

      try {
        await fetch(`/api/user/attestations/${att.id}/claim`, { method: "POST" });
        queryClient.invalidateQueries({ queryKey: ["user-attestations"] });
      } catch (e) {
        console.error("Error claiming:", e);
      }
    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloading(null);
    }
  };

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "all" || typeFilter !== "all";

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
      case "CLAIMED": return "bg-blue-100 text-blue-700 border-blue-200";
      case "REJECTED": return "bg-rose-100 text-rose-700 border-rose-200";
      default: return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "VALIDATED": return "Validée";
      case "CLAIMED": return "Récupérée";
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
        <Card className="p-4 bg-white shadow-sm h-16 animate-pulse" aria-hidden="true" />
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // Échec de chargement : message d'erreur + relance, jamais « zéro document ».
  if (isError) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
            Mes Attestations
          </h1>
          <p className="text-slate-600 text-sm font-medium mt-1">
            Consultez et téléchargez vos documents officiels.
          </p>
        </header>
        <CandidateErrorState
          onRetry={() => {
            void refetch();
          }}
          isRetrying={isFetching}
          title="Impossible de charger vos attestations"
          description="Vos documents n'ont pas pu être récupérés. Vérifiez votre connexion internet puis relancez le chargement."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <Tabs defaultValue="attestations" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-8 bg-slate-100/50 p-1.5 rounded-[1.5rem]">
          <TabsTrigger value="attestations" className="rounded-xl font-bold py-3 text-sm sm:text-base data-[state=active]:shadow-md">
            <Award className="w-4 h-4 mr-2" /> Mes Attestations
          </TabsTrigger>
          <TabsTrigger value="releves" className="rounded-xl font-bold py-3 text-sm sm:text-base data-[state=active]:shadow-md">
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Mes Relevés de Notes
          </TabsTrigger>
          <TabsTrigger value="resultats" className="rounded-xl font-bold py-3 text-sm sm:text-base data-[state=active]:shadow-md">
            <BarChart3 className="w-4 h-4 mr-2" /> Détail de mes Résultats
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="attestations" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-white shadow-sm rounded-2xl border-none shadow-slate-200/50">
                <p className="text-sm text-slate-500 font-medium">Total</p>
                <p className="text-3xl font-black text-slate-800 tracking-tight">{data?.stats?.total || 0}</p>
              </Card>
              <Card className="p-4 bg-white shadow-sm rounded-2xl border-none shadow-slate-200/50 border-l-4 border-l-emerald-500">
                <p className="text-sm text-slate-500 font-medium">Validées</p>
                <p className="text-3xl font-black text-emerald-600 tracking-tight">{data?.stats?.validated || 0}</p>
              </Card>
              <Card className="p-4 bg-white shadow-sm rounded-2xl border-none shadow-slate-200/50 border-l-4 border-l-amber-500">
                <p className="text-sm text-slate-500 font-medium">En attente</p>
                <p className="text-3xl font-black text-amber-600 tracking-tight">{data?.stats?.pending || 0}</p>
              </Card>
              <Card className="p-4 bg-white shadow-sm rounded-2xl border-none shadow-slate-200/50 border-l-4 border-l-rose-500">
                <p className="text-sm text-slate-500 font-medium">Rejetées</p>
                <p className="text-3xl font-black text-rose-600 tracking-tight">{data?.stats?.rejected || 0}</p>
              </Card>
            </div>

            {/* Filters */}
            <Card className="p-6 bg-white shadow-xl shadow-slate-200/50 rounded-3xl border-none">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-slate-600" aria-hidden="true" />
                <span className="text-sm font-black uppercase tracking-widest text-slate-700">Filtres</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, code ou formation..."
                    className="pl-12 h-12 bg-slate-50 border-none rounded-2xl font-medium"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-2xl font-medium">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="VALIDATED">Validée</SelectItem>
                    <SelectItem value="PENDING">En attente</SelectItem>
                    <SelectItem value="REJECTED">Rejetée</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-2xl font-medium">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="FORMATION">Formation</SelectItem>
                    <SelectItem value="STAGE">Stage</SelectItem>
                    <SelectItem value="CERTIFICATION">Certification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(search || statusFilter !== "all" || typeFilter !== "all") && (
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setTypeFilter("all");
                    }}
                    className="gap-2 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-slate-100"
                  >
                    <X className="w-3 h-3" />
                    Réinitialiser
                  </Button>
                  <Badge variant="secondary" className="rounded-lg">{filteredAttestations?.length || 0} résultat(s)</Badge>
                </div>
              )}
            </Card>

            {/* List */}
            {!filteredAttestations || filteredAttestations.length === 0 ? (
              hasActiveFilters ? (
                <CandidateEmptyState
                  icon={
                    <Search className="h-8 w-8 text-slate-500" aria-hidden="true" />
                  }
                  title="Aucune attestation ne correspond à vos filtres"
                  description="Aucune attestation ne correspond à la recherche, au statut ou au type sélectionné. Ajustez ou réinitialisez vos filtres pour revoir vos documents."
                  primaryAction={{
                    label: "Réinitialiser les filtres",
                    onClick: () => {
                      setSearch("");
                      setStatusFilter("all");
                      setTypeFilter("all");
                    },
                  }}
                />
              ) : (
                <CandidateEmptyState
                  icon={
                    <FileText className="h-8 w-8 text-slate-500" aria-hidden="true" />
                  }
                  title="Vous n'avez pas encore d'attestation"
                  description="Vos attestations apparaîtront ici dès qu'elles seront émises et validées par la Ferme Saint André."
                />
              )
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredAttestations.map((att: any) => (
                  <Card key={att.id} className="p-6 bg-white shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border-none rounded-[2rem] group">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                      <div className="flex items-start gap-5 flex-1 min-w-0 w-full">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                          <Award className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h3 className="font-black text-slate-900 text-lg leading-tight truncate" title={att.fullName}>
                              {att.fullName}
                            </h3>
                            <Badge className={`${att.isLocked ? "bg-slate-100 text-slate-500" : getStatusBadgeColor(att.status)} text-[10px] font-black uppercase tracking-widest px-2.5 py-1 border-none rounded-lg`}>
                              {att.isLocked ? (
                                <span className="flex items-center gap-1.5">
                                  <Lock className="w-3 h-3" /> Délibération en cours
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  {att.status === "CLAIMED" && <CheckCircle className="w-3 h-3" />}
                                  {getStatusLabel(att.status)}
                                </span>
                              )}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-slate-600 mb-3">
                            {att.formation?.name || "-"} <span className="text-slate-500 mx-2" aria-hidden="true">•</span>
                            <span className="text-brand font-bold uppercase tracking-widest text-[10px]">
                              {att.type === "FORMATION" ? "Formation" : att.type === "STAGE" ? "Stage" : "Certification"}
                            </span>
                          </p>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs font-medium text-slate-500 bg-slate-50 p-3 sm:p-2 sm:bg-transparent rounded-xl sm:rounded-none">
                            <div className="flex items-center gap-2">
                              <QrCode className="w-4 h-4 text-slate-500" aria-hidden="true" />
                              <span>Code: <span className="font-mono font-bold bg-white sm:bg-slate-100 px-2 py-1 rounded-md shadow-sm sm:shadow-none">{att.isLocked ? "••••-••••-••••" : att.code}</span></span>
                            </div>
                            <span className="hidden sm:inline text-slate-500" aria-hidden="true">•</span>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-500" aria-hidden="true" />
                              <span>Obtenue le {new Date(att.issuedAt).toLocaleDateString("fr-FR")}</span>
                            </div>
                          </div>

                          {(att.status === "CLAIMED" || (att.status === "VALIDATED" && !att.isLocked)) && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-amber-600 text-[11px] font-bold uppercase tracking-widest mt-3 hover:text-amber-700 flex items-center gap-1.5"
                              onClick={() => {
                                setReportingAtt(att);
                                setReportLostOpen(true);
                              }}
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              J'ai perdu mon attestation ou besoin d'un duplicata
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto pt-5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
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
                            className="w-full gap-2 rounded-xl h-12 sm:h-11 shadow-sm font-bold border-slate-200"
                            disabled={(att.status !== "VALIDATED" && att.status !== "CLAIMED") || att.isLocked}
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-widest">
                              {att.status === "CLAIMED" ? "Revoir" : "Aperçu"}
                            </span>
                          </Button>
                        </Link>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 sm:h-11 sm:w-11 rounded-xl shadow-sm border-slate-200"
                            onClick={() => {
                              if (att.isLocked) {
                                toast.warning("🔒 Le partage sera activé après la délibération.");
                                return;
                              }
                              setSelectedAttestation(att);
                              setQrDialogOpen(true);
                            }}
                            title={att.isLocked ? "Verrouillé" : "Partager le QR Code"}
                            disabled={att.isLocked || (att.status !== "VALIDATED" && att.status !== "CLAIMED")}
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            className={`h-12 w-12 sm:h-11 sm:w-11 rounded-xl shadow-sm border-slate-200 ${downloading === att.code ? 'border-emerald-200 bg-emerald-50' : ''} ${att.status === "CLAIMED" ? "border-blue-200 bg-blue-50 text-blue-600" : ""}`}
                            onClick={() => {
                              if (att.isLocked) {
                                toast.warning("🔒 Le téléchargement sera disponible après la délibération.");
                                return;
                              }
                              if (att.status === "CLAIMED") {
                                 toast.info("Vous avez déjà téléchargé cette attestation. Un nouveau téléchargement est possible.");
                              }
                              handleDownload(att);
                            }}
                            disabled={(att.status !== "VALIDATED" && att.status !== "CLAIMED") || downloading === att.code || att.isLocked}
                            title={att.isLocked ? "Verrouillé" : (att.status === "CLAIMED" ? "Télécharger à nouveau" : "Télécharger en PDF")}
                          >
                            {downloading === att.code ? (
                              <div className="animate-spin w-4 h-4 border-2 border-brand border-t-transparent rounded-full" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </TabsContent>

        <TabsContent value="releves" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="p-12 border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] bg-gradient-to-br from-brand/10 to-white flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-[2rem] bg-brand/10 flex items-center justify-center mb-6 shadow-inner">
              <FileSpreadsheet className="w-12 h-12 text-brand" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Mes Relevés de Notes</h3>
            <p className="text-slate-500 text-lg font-medium max-w-lg mx-auto mb-10">
              Retrouvez ici tous vos relevés de notes détaillés par module pour chaque session d'examen.
            </p>
            <Link href="/exams">
              <Button className="bg-brand hover:bg-brand-dark text-white rounded-2xl h-14 px-10 font-black uppercase tracking-widest text-xs gap-3 shadow-lg shadow-brand/20 transition-all hover:-translate-y-1">
                Accéder à mes examens <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </Card>
        </TabsContent>

        <TabsContent value="resultats" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="p-12 border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] bg-gradient-to-br from-brand/10 to-white flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-[2rem] bg-brand/10 flex items-center justify-center mb-6 shadow-inner">
              <BarChart3 className="w-12 h-12 text-brand" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Détail de mes Résultats</h3>
            <p className="text-slate-500 text-lg font-medium max-w-lg mx-auto mb-10">
              Consultez vos statistiques, votre progression et le détail de vos performances aux examens.
            </p>
            <Link href="/exams">
              <Button className="bg-brand hover:bg-brand-dark text-white rounded-2xl h-14 px-10 font-black uppercase tracking-widest text-xs gap-3 shadow-lg shadow-brand/20 transition-all hover:-translate-y-1">
                Voir mes statistiques <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Code de vérification</DialogTitle>
          </DialogHeader>
          {selectedAttestation && (
            <div className="text-center space-y-6 py-4">
              <div className="flex justify-center p-4 bg-slate-50 rounded-3xl inline-block mx-auto border border-slate-100">
                <QRCodeSVG
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/verifier?code=${encodeURIComponent(selectedAttestation.code)}`}
                  size={200}
                  level="H"
                  className="rounded-xl"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Code de l'attestation</p>
                <p className="font-mono text-2xl font-black text-slate-900 bg-slate-100 py-2 px-4 rounded-xl inline-block">{selectedAttestation.code}</p>
              </div>
              <p className="text-sm font-medium text-slate-500 max-w-xs mx-auto">
                Scannez ce QR code pour vérifier l'authenticité de l'attestation sur notre plateforme.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lost Attestation Dialog */}
      <Dialog open={reportLostOpen} onOpenChange={setReportLostOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-black">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              Signaler un problème
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              Vous avez besoin d'un duplicata ou vous rencontrez un problème avec l'attestation
              <span className="font-black text-slate-900 ml-1">
                {reportingAtt?.fullName}
              </span> ?
            </p>
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Expliquez votre situation :</label>
              <textarea
                className="w-full min-h-[120px] p-4 text-sm font-medium border-none bg-slate-50 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none"
                placeholder="Ex: J'ai perdu mon fichier PDF, j'aimerais qu'on me le renvoie par email..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              />
            </div>
            <div className="bg-amber-50/50 p-4 rounded-2xl text-xs font-medium text-amber-800 flex gap-3 items-start">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              L'administration recevra votre demande et vous contactera par email sous 48h.
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setReportLostOpen(false)} className="rounded-xl font-bold">Annuler</Button>
            <Button
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold px-6"
              onClick={async () => {
                if (!reportReason.trim()) {
                  toast.error("Veuillez expliquer votre problème.");
                  return;
                }
                setSubmittingReport(true);
                try {
                  const res = await fetch("/api/signalement", {
                    method: "POST",
                    body: JSON.stringify({
                      code: reportingAtt?.code,
                      motif: "PERTE_OU_DUPLICATA",
                      message: reportReason
                    })
                  });
                  if (!res.ok) throw new Error();
                  toast.success("Demande envoyée avec succès !");
                  setReportLostOpen(false);
                  setReportReason("");
                } catch (e) {
                  toast.error("Erreur lors de l'envoi du signalement.");
                } finally {
                  setSubmittingReport(false);
                }
              }}
              disabled={submittingReport}
            >
              {submittingReport ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Envoyer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates cachés pour la génération PDF (Capture technique) */}
      <div className="absolute top-0 left-0 opacity-0 pointer-events-none -z-50 overflow-hidden" style={{ width: '1120px' }}>
        {data?.attestations?.filter((a: any) => (a.status === "VALIDATED" || a.status === "CLAIMED") && !a.isLocked).map((att: any) => (
          <div key={`capture-${att.id}`}>
             <CertificateTemplate
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
          </div>
        ))}
      </div>
    </div>
  );
}
