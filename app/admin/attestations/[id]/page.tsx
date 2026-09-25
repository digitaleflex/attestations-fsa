"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  RotateCcw,
  Download, 
  Edit, 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  User, 
  Calendar, 
  MapPin, 
  GraduationCap, 
  Award, 
  QrCode, 
  ClipboardList,
  Send,
  Trash2,
  History as HistoryIcon
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils"; // Force import recognition
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import OfficialDocumentComponent from "@/components/OfficialDocument";

/**
 * Page de détails de l'attestation - FSA Admin
 */

type AttestationData = {
  id: string;
  code: string;
  fullName: string;
  gender?: string;
  birthDate: string;
  birthPlace: string;
  formation: { name: string; category?: string };
  type: string;
  stageHours?: number;
  stageScore?: number;
  certificationMention?: string;
  certificationScore?: number;
  startDate: string;
  endDate: string;
  location: string;
  certificationHours?: number;
  instructor: string;
  issuingCompany: string;
  status: string;
  issuedAt: string;
  userId: string;
};

function DateLocale({ date, options }: { date: string | Date; options?: Intl.DateTimeFormatOptions }) {
  const [formatted, setFormatted] = useState("");
  useEffect(() => {
    if (date) {
      setFormatted(new Date(date).toLocaleDateString("fr-FR", options));
    }
  }, [date, options]);
  return <span>{formatted}</span>;
}

export default function AttestationDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [data, setData] = useState<AttestationData | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeDoc, setActiveDoc] = useState<"ATTESTATION">("ATTESTATION");

  // Fetch settings for dynamic branding
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch("/api/public/settings");
      if (!res.ok) return null;
      return res.json();
    }
  });

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    apiFetch(`/api/attestations/${id}`, {}, false)
      .then(async (attData: any) => {
        setData(attData);
        setLoading(false);
      })
      .catch((e: any) => {
        // Un échec réseau ne doit pas ressembler à un document absent : on
        // conserve le message pour proposer une relance.
        setLoadError(e?.message || "Impossible de charger cette attestation");
        setLoading(false);
      });
  }, [id, reloadKey]);

  const [actionReason, setActionReason] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const fetchAuditLogs = async () => {
    try {
      const logs = await apiFetch(`/api/admin/attestations/${id}/audit`, {}, false) as any;
      setAuditLogs(logs);
    } catch (e) {
      console.error("Erreur lors du chargement des logs d'audit");
    }
  };

  useEffect(() => {
    if (id) fetchAuditLogs();
  }, [id]);

  const handleAdminAction = async (action: "REVOKE" | "RETROGRADE") => {
    if (!actionReason || actionReason.trim().length < 5) {
      return toast.error("Veuillez saisir un motif d'au moins 5 caractères.");
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/attestations/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: actionReason }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Une erreur est survenue");
      }

      if (action === 'RETROGRADE') {
        toast.success("✅ Candidat rétrogradé. L'attestation est maintenant 'En attente' et l'examen réinitialisé.");
        // Rafraîchir les données locales au lieu de rediriger
        apiFetch(`/api/attestations/${id}`, {}, false).then(setData as any);
        fetchAuditLogs();
        return;
      }

      const updated = await res.json();
      setData(updated.attestation);
      setActionReason(""); // Reset motif
      fetchAuditLogs(); // Rafraîchir l'historique
      toast.success(action === 'REVOKE' ? "🚫 Attestation révoquée !" : "🔄 Candidat rétrogradé !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'action");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatus = async (status: "VALIDATED" | "REJECTED") => {
    setActionLoading(true);
    try {
      await apiFetch(`/api/attestations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setData((prev) => prev ? { ...prev, status } : null);
      toast.success(status === "VALIDATED" ? "✅ Attestation validée !" : "❌ Attestation rejetée !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`/api/attestations/${id}`, { method: "DELETE" });
      toast.success("🗑️ Attestation supprimée avec succès");
      router.push("/admin/attestations");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
      setIsDeleting(false);
    }
  };

  const handleDownloadAttestation = async () => {
    if (!data) return;
    const fileName = `${data.code.slice(-5)}_${data.fullName.replace(/\s+/g, "_")}.pdf`;

    toast.promise(
      (async () => {
        try {
          setIsPrinting(true);
          await new Promise((resolve) => setTimeout(resolve, 600));

          const html2pdf = (await import("html2pdf.js")).default;
          const element = document.getElementById("minimalist-preview-card");

          if (!element) {
            throw new Error("Aperçu du diplôme non trouvé");
          }

          const opt = {
            margin: 0,
            filename: fileName,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              letterRendering: true,
              width: 1120,
              windowWidth: 1120,
            },
            jsPDF: {
              unit: "mm",
              format: "a4",
              orientation: "landscape",
            },
          };

          await html2pdf().set(opt).from(element).save();

          await fetch("/api/admin/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "ATTESTATION_EXPORTED",
              resource: "ATTESTATION",
              resourceId: id,
              userId: data.userId,
              details: { fileName, docType: "ATTESTATION" },
            }),
          });
        } catch (error: any) {
          console.error("PDF Generation Error (Admin):", error);
          throw error;
        } finally {
          setIsPrinting(false);
        }
      })(),
      {
        loading: "Génération du diplôme officiel...",
        success: "Téléchargement réussi !",
        error: (err) => `Erreur : ${err.message || "Problème technique"}`,
      }
    );
  };

  const handleTransmitTranscript = async () => {
    if (!data?.userId) return;
    setActionLoading(true);
    try {
        await fetch("/api/user/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: data.userId,
                type: "EXAM_RESULT_PUBLISHED",
                title: "Relevé de Notes disponible ! 📊",
                message: "Votre relevé de notes officiel de la session d'examen est maintenant disponible sur votre portail.",
                link: "/results"
            })
        });

        // Logger la transmission dans l'audit trail
        await fetch("/api/admin/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: 'TRANSCRIPT_TRANSMITTED',
              resource: 'ATTESTATION',
              resourceId: id,
              userId: data.userId,
              details: { method: 'PORTAL_NOTIFICATION' }
            })
        });

        toast.success("🚀 Relevé transmis au candidat !");
    } catch (e) {
        toast.error("Échec de la transmission");
    } finally {
        setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 aria-hidden="true" className="animate-spin w-8 h-8 text-slate-500" />
        <p className="text-sm font-medium text-slate-600">Chargement de l'attestation…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-4xl mx-auto">
          <Alert variant={loadError ? "default" : "destructive"}>
            <AlertTitle>{loadError ? "Chargement impossible" : "Attestation non trouvée"}</AlertTitle>
            <AlertDescription>
              {loadError
                ? `${loadError} Vérifiez votre connexion puis réessayez.`
                : "Cette attestation n'existe pas ou a été supprimée."}
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-3 mt-4">
            {loadError && (
              <Button onClick={() => setReloadKey((k) => k + 1)} className="gap-2">
                <RotateCcw aria-hidden="true" className="w-4 h-4" />
                Réessayer
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/admin/attestations">← Retour à la liste</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "FORMATION": return GraduationCap;
      case "STAGE": return FileText;
      case "CERTIFICATION": return Award;
      default: return FileText;
    }
  };

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
      case "REJECTED": return "Révoquée";
      default: return "En attente";
    }
  };

  const TypeIcon = getTypeIcon(data.type);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/attestations">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">📜 Détail de l'attestation</h1>
              <p className="text-sm text-slate-500">{data.code}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <Link href={`/admin/attestations/${id}/edit`} className="flex-1 sm:flex-none">
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <Edit className="w-4 h-4" />
                  Modifier
                </Button>
              </Link>
              <Button onClick={() => handleDownloadAttestation()} variant="outline" className="gap-2 bg-brand/10 text-brand-dark border-brand/30 w-full sm:w-auto">
                <Download className="w-4 h-4" />
                Télécharger PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Statut */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
                <TypeIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Type</p>
                <p className="font-semibold text-slate-800">
                  {data.type === "FORMATION" ? "Formation" : data.type === "STAGE" ? "Stage" : "Certification"}
                </p>
              </div>
            </div>
            <Badge className={getStatusBadgeColor(data.status)}>
              {data.status === "VALIDATED" ? <CheckCircle className="w-3 h-3 mr-1" /> :
               data.status === "REJECTED" ? <XCircle className="w-3 h-3 mr-1" /> :
               <Clock className="w-3 h-3 mr-1" />}
              {getStatusLabel(data.status)}
            </Badge>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Aperçu de l'attestation - Minimaliste et Pro */}
          <Card className="lg:col-span-2 p-0 bg-white shadow-lg overflow-hidden border-none ring-1 ring-slate-200">
            {/* Header de l'aperçu */}
            <div className="bg-slate-50 border-b p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                        <Award className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="font-bold text-slate-700 block text-sm">
                            Diplôme Officiel
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Aperçu du contenu
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">{data.id}</Badge>
                </div>
            </div>

            {/* Corps minimaliste */}
            <div className="p-8 md:p-12 bg-white flex justify-center items-center min-h-[500px]">
                <OfficialDocumentComponent 
                    id="minimalist-preview-card"
                    isPrinting={isPrinting}
                    data={{
                        id: data.id,
                        code: data.code,
                        fullName: data.fullName,
                        formationName: data.formation?.name || "Formation Professionnelle",
                        type: data.type,
                        startDate: data.startDate,
                        endDate: data.endDate,
                        score: data.type === "FORMATION" ? (data.certificationScore || 0) : (data.stageScore || 0),
                        status: data.status,
                        issuedAt: data.issuedAt
                    }}
                />
            </div>
          </Card>

          {/* Informations et actions */}
          <div className="space-y-6">
            {/* QR Code */}
            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-brand" />
                <h3 className="font-semibold text-slate-800">QR Code de vérification</h3>
              </div>
              <div className="flex justify-center">
                <QRCodeSVG 
                  value={`${window.location.origin}/verifier?code=${encodeURIComponent(data.code)}`}
                  size={180}
                  level="H"
                />
              </div>
              <p className="text-xs text-slate-500 text-center mt-3">
                Scannez pour vérifier l'authenticité
              </p>
            </Card>

            {/* Informations détaillées */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="font-semibold text-lg mb-4 text-slate-800">📋 Informations</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <dt className="text-slate-500">Code</dt>
                  <dd className="font-mono font-medium ml-auto">{data.code}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <dt className="text-slate-500">Bénéficiaire</dt>
                  <dd className="font-medium ml-auto">{data.fullName}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <dt className="text-slate-500">Date de naissance</dt>
                  <dd className="ml-auto"><DateLocale date={data.birthDate} /></dd>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <dt className="text-slate-500">Lieu de naissance</dt>
                  <dd className="ml-auto">{data.birthPlace}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-slate-400" />
                  <dt className="text-slate-500">Formation</dt>
                  <dd className="ml-auto">{data.formation?.name || "-"}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <dt className="text-slate-500">Créée le</dt>
                  <dd className="ml-auto"><DateLocale date={data.issuedAt} /></dd>
                </div>
              </dl>
            </Card>

            {/* Actions */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="font-semibold text-lg mb-4 text-slate-800">⚡ Actions</h3>
              <div className="space-y-3">
                <div className="h-px bg-slate-100 my-4" />
                <div className="flex flex-col gap-3">
                    {data.status !== "REJECTED" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full gap-2 border-amber-300 text-amber-600 hover:bg-amber-50"
                              disabled={actionLoading}
                            >
                              <XCircle className="w-4 h-4" />
                              Révoquer l'attestation
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white border-2 border-amber-100 shadow-2xl">
                             <AlertDialogHeader>
                               <AlertDialogTitle className="flex items-center gap-2 text-amber-600 font-bold text-xl">
                                 ⚠️ Annuler cette attestation ?
                               </AlertDialogTitle>
                               <AlertDialogDescription className="text-slate-600 mt-2 text-base">
                                 Cela marquera ce certificat comme <span className="font-bold underline">REJETÉ</span>. 
                                 Le candidat ne pourra plus l'utiliser officiellement.<br/><br/>
                                 <strong className="text-slate-900">Motif de la révocation obligatoire :</strong>
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <div className="py-4">
                                <Input 
                                    placeholder="Ex: Erreur de saisie noms, Inaptitude détectée..." 
                                    value={actionReason}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActionReason(e.target.value)}
                                    className="border-amber-100 focus-visible:ring-amber-500"
                                />
                             </div>
                             <AlertDialogFooter className="mt-4 gap-3">
                               <AlertDialogCancel className="border-slate-200">Annuler</AlertDialogCancel>
                               <AlertDialogAction 
                                 onClick={() => handleAdminAction('REVOKE')} 
                                 disabled={actionReason.length < 5}
                                 className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200"
                               >
                                 Confirmer la Révocation
                               </AlertDialogAction>
                             </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                          disabled={actionLoading}
                        >
                          <ArrowLeft className="w-4 h-4 rotate-90" />
                          Rétrograder le Candidat
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white border-2 border-rose-100 shadow-2xl rounded-3xl">
                         <AlertDialogHeader>
                           <AlertDialogTitle className="flex items-center gap-3 text-rose-600 font-bold text-xl">
                             <ArrowLeft className="w-6 h-6 rotate-90" />
                             Rétrograder et Repasser l'examen ?
                           </AlertDialogTitle>
                           <AlertDialogDescription className="text-slate-600 mt-2 text-base leading-relaxed">
                             ⚠️ <span className="font-bold text-slate-900">Action Irréversible !!</span><br/><br/>
                             1. L'attestation sera <span className="text-rose-600 font-bold">supprimée définitivement</span>.<br/>
                             2. Les scores actuels seront <span className="text-rose-600 font-bold">effacés</span>.<br/>
                             3. Le candidat devra <span className="text-rose-600 font-bold">repasser intégralement son examen</span>.<br/><br/>
                             <strong className="text-slate-900">Motif de la rétrogradation :</strong>
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <div className="py-4">
                            <Input 
                                placeholder="Ex: Tricherie prouvée, Incohérence des notes..." 
                                value={actionReason}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActionReason(e.target.value)}
                                className="border-rose-200 focus-visible:ring-rose-500"
                            />
                         </div>
                         <AlertDialogFooter className="mt-4 gap-3">
                           <AlertDialogCancel className="border-slate-200">Abandonner</AlertDialogCancel>
                           <AlertDialogAction 
                             onClick={() => handleAdminAction('RETROGRADE')} 
                             disabled={actionReason.length < 5}
                             className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200"
                           >
                             Rétrograder Maintenant
                           </AlertDialogAction>
                         </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>

                <div className="h-px bg-slate-100 my-4" />
                {auditLogs.length > 0 && (
                  <Card className="p-5 bg-slate-50 border-none shadow-inner">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <ClipboardList className="w-3 h-3" /> Fil d'activité officiel
                    </h4>
                    <div className="space-y-4">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="relative pl-4 border-l-2 border-slate-200 py-1">
                          <p className="text-xs font-bold text-slate-700">
                             {log.action === 'ATTESTATION_REVOKED' ? '🚫 RÉVOCATION' : 
                              log.action === 'USER_RETROGRADED' ? '🔄 RÉTROGRADATION' : 
                              log.action === 'ATTESTATION_VALIDATED' ? '✅ VALIDATION' : '📝 ACTION'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            par {log.user?.name || log.user?.email} • <DateLocale date={log.timestamp} options={{ hour: '2-digit', minute: '2-digit' }} />
                          </p>
                          {log.newValue?.reason && (
                            <p className="text-[11px] mt-1 italic text-slate-600 font-medium">" {log.newValue.reason} "</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {data.status === "PENDING" && (
                  <>
                    <Button
                      onClick={() => handleStatus("VALIDATED")}
                      className="w-full gap-2 bg-brand hover:bg-brand-dark"
                      disabled={actionLoading}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Valider l'attestation
                    </Button>
                    <Button
                      onClick={() => handleStatus("REJECTED")}
                      variant="outline"
                      className="w-full gap-2 border-rose-300 text-rose-600 hover:bg-rose-50"
                      disabled={actionLoading}
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeter l'attestation
                    </Button>
                  </>
                )}
                    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="w-full gap-2"
                          disabled={actionLoading || isDeleting}
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-xl">
                            <Trash2 className="w-6 h-6" />
                            Confirmer la suppression
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-600 mt-2 text-base leading-relaxed">
                            Cette action est <span className="font-bold text-slate-900 underline decoration-rose-200">définitive</span>. 
                            L'attestation <strong>{data.code}</strong> sera effacée définitivement de la base de données.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 gap-3">
                          <AlertDialogCancel 
                            disabled={isDeleting}
                            className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                          >
                            Annuler
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200"
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Suppression en cours...
                                </>
                            ) : (
                                "Supprimer l'attestation"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
