"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { SoftDeleteAttestationDialog } from "@/components/admin/attestations/SoftDeleteAttestationDialog";
import {
  LifecycleReasonField,
  LIFECYCLE_REASON_MIN_LENGTH,
} from "@/components/admin/attestations/LifecycleReasonField";
import OfficialDocumentComponent from "@/components/OfficialDocument";
import {
  attestationVerificationPath,
  isOfficialPdfDownloadable,
  startOfficialPdfDownload,
} from "@/lib/attestations/client-download";

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
  pdfVersion?: number | null;
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
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

  // Un motif par action : les deux dialogues de cycle de vie ne partagent plus
  // le même champ, sinon un motif de révocation pouvait être envoyé tel quel
  // dans une rétrogradation.
  const [revokeReason, setRevokeReason] = useState("");
  const [retrogradeReason, setRetrogradeReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
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

  const handleAdminAction = async (action: "REVOKE" | "RETROGRADE", reason: string) => {
    const trimmed = reason.trim();
    if (trimmed.length < LIFECYCLE_REASON_MIN_LENGTH) {
      return toast.error(`Veuillez saisir un motif d'au moins ${LIFECYCLE_REASON_MIN_LENGTH} caractères.`);
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/attestations/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: trimmed }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        // Une ligne supprimée logiquement est figée : le dire clairement plutôt
        // que de laisser un « Une erreur est survenue » sans issue.
        if (err.code === "ATTESTATION_ALREADY_SOFT_DELETED") {
          setActionError(
            "Cette attestation est supprimée logiquement : elle est figée, plus aucune action de cycle de vie n'est possible.",
          );
          return;
        }
        if (err.code === "MOTIF_REQUIS") {
          setActionError(
            `Le serveur a refusé l'action : un motif d'au moins ${LIFECYCLE_REASON_MIN_LENGTH} caractères est obligatoire.`,
          );
          return;
        }
        throw new Error(err.error || "Une erreur est survenue");
      }

      if (action === "RETROGRADE") {
        toast.success("Candidat rétrogradé. L'attestation repasse « En attente » et la session d'examen est archivée.");
        // Rafraîchir les données locales au lieu de rediriger
        apiFetch(`/api/attestations/${id}`, {}, false).then(setData as any);
        fetchAuditLogs();
        setRetrogradeReason("");
        return;
      }

      const updated = await res.json();
      setData(updated.attestation);
      setRevokeReason(""); // Reset motif
      fetchAuditLogs(); // Rafraîchir l'historique
      toast.success("Attestation révoquée : elle reste visible publiquement, marquée « révoquée ».");
    } catch (err: any) {
      const message =
        err?.message && err.message !== "Une erreur est survenue"
          ? err.message
          : "L'action n'a pas abouti. L'attestation est inchangée. Réessayez.";
      setActionError(message);
      toast.error(message);
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

  // Le dialogue partagé exécute lui-même la suppression logique (motif
  // obligatoire) : cette page se limite au retour vers la liste.
  const handleDeleted = () => {
    setShowDeleteDialog(false);
    router.push("/admin/attestations");
  };

  // #258 : le PDF est généré et scellé par le serveur. L'administration
  // télécharge le document probant existant, elle ne le régénère pas.
  const handleDownloadAttestation = async () => {
    if (!data) return;
    if (!startOfficialPdfDownload(data.code)) {
      toast.error("Le téléchargement a été bloqué par le navigateur : autorisez les pop-ups pour ce site.");
      return;
    }
    try {
      await fetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ATTESTATION_EXPORTED",
          resource: "ATTESTATION",
          resourceId: id,
          userId: data.userId,
          details: { docType: "ATTESTATION", source: "SERVER_PDF", pdfVersion: data.pdfVersion ?? null },
        }),
      });
    } catch (error) {
      console.error("Audit download (Admin):", error);
    }
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
      // `REVOKED` (révocation publique) et `REJECTED` (rejet de dossier) sont
      // deux états distincts côté serveur : ne pas les confondre en un seul
      // mot affiché à l'opérateur.
      case "REVOKED": return "Révoquée";
      case "REJECTED": return "Rejetée";
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
              <Button
                onClick={() => handleDownloadAttestation()}
                disabled={!isOfficialPdfDownloadable(data.status)}
                variant="outline"
                className="gap-2 bg-brand/10 text-brand-dark border-brand/30 w-full sm:w-auto"
                title={isOfficialPdfDownloadable(data.status) ? "Télécharger le PDF serveur scellé" : "Aucun PDF serveur disponible pour ce statut"}
              >
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
               data.status === "REJECTED" || data.status === "REVOKED" ? <XCircle className="w-3 h-3 mr-1" /> :
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
                    id="official-preview-card"
                    data={{
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
                  value={`${window.location.origin}${attestationVerificationPath(data.code)}`}
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
                    {/* Révocation — le document reste visible publiquement. */}
                    {data.status !== "REJECTED" && data.status !== "REVOKED" && (
                        <AlertDialog onOpenChange={(open) => { if (open) setActionError(null); }}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                              disabled={actionLoading}
                            >
                              <XCircle className="w-4 h-4" aria-hidden="true" />
                              Révoquer l&apos;attestation
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white border-2 border-amber-100 shadow-2xl rounded-3xl sm:max-w-xl">
                             <AlertDialogHeader>
                               <AlertDialogTitle className="flex items-center gap-2 text-amber-600 font-bold text-xl">
                                 <XCircle className="w-6 h-6" aria-hidden="true" />
                                 Révoquer cette attestation ?
                               </AlertDialogTitle>
                               <AlertDialogDescription className="text-slate-600 mt-2 text-sm leading-relaxed font-medium">
                                 Le document <span className="font-bold text-slate-900">reste visible et
                                 vérifiable</span> publiquement, mais il est marqué
                                 <span className="font-bold text-amber-700"> «&nbsp;révoquée&nbsp;»</span>{" "}
                                 (statut, date, auteur, motif). Pour la retirer du vérificateur
                                 public, utilisez la suppression logique, plus bas.
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <div className="py-4">
                               <LifecycleReasonField
                                 id="attestation-revoke-reason"
                                 label="Motif de la révocation (obligatoire)"
                                 tone="amber"
                                 value={revokeReason}
                                 onChange={setRevokeReason}
                                 serverError={actionError}
                                 placeholder="Ex : erreur de saisie du nom à la source, attestation non délivrée."
                               />
                             </div>
                             <AlertDialogFooter className="mt-2 gap-3">
                               <AlertDialogCancel className="border-slate-200 font-bold rounded-xl min-h-[44px]">
                                 Annuler
                               </AlertDialogCancel>
                               <AlertDialogAction
                                 onClick={() => handleAdminAction("REVOKE", revokeReason)}
                                 disabled={revokeReason.trim().length < LIFECYCLE_REASON_MIN_LENGTH || actionLoading}
                                 aria-busy={actionLoading}
                                 className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200 font-bold rounded-xl min-h-[44px]"
                               >
                                 Confirmer la révocation
                               </AlertDialogAction>
                             </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    )}

                    {/* Rétrogradation — la session est archivée, jamais supprimée. */}
                    <AlertDialog onOpenChange={(open) => { if (open) setActionError(null); }}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                          disabled={actionLoading}
                        >
                          <ArrowLeft className="w-4 h-4 rotate-90" aria-hidden="true" />
                          Rétrograder le candidat
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white border-2 border-rose-100 shadow-2xl rounded-3xl sm:max-w-xl">
                         <AlertDialogHeader>
                           <AlertDialogTitle className="flex items-center gap-3 text-rose-600 font-bold text-xl">
                             <ArrowLeft className="w-6 h-6 rotate-90" aria-hidden="true" />
                             Rétrograder le candidat ?
                           </AlertDialogTitle>
                           <AlertDialogDescription className="text-slate-600 mt-2 text-sm leading-relaxed font-medium">
                             L&apos;attestation repasse <span className="font-bold text-slate-900">«&nbsp;En
                             attente&nbsp;»</span> et la session d&apos;examen est
                             <span className="font-bold text-slate-900"> archivée</span> — jamais
                             supprimée : le sceau et le PDF restent lisibles. Les scores sont remis à
                             zéro et le candidat doit repasser l&apos;examen.
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <div className="py-4">
                           <LifecycleReasonField
                             id="attestation-retrograde-reason"
                             label="Motif de la rétrogradation (obligatoire)"
                             tone="rose"
                             value={retrogradeReason}
                             onChange={setRetrogradeReason}
                             serverError={actionError}
                             placeholder="Ex : scores incohérents avec la copie, examen à repasser."
                           />
                         </div>
                         <AlertDialogFooter className="mt-2 gap-3">
                           <AlertDialogCancel className="border-slate-200 font-bold rounded-xl min-h-[44px]">
                             Annuler
                           </AlertDialogCancel>
                           <AlertDialogAction
                             onClick={() => handleAdminAction("RETROGRADE", retrogradeReason)}
                             disabled={retrogradeReason.trim().length < LIFECYCLE_REASON_MIN_LENGTH || actionLoading}
                             aria-busy={actionLoading}
                             className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 font-bold rounded-xl min-h-[44px]"
                           >
                             Rétrograder le candidat
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
                             {log.action === 'ATTESTATION_REVOKED' ? 'Révocation' :
                              log.action === 'ATTESTATION_DELETED' ? 'Suppression logique' :
                              log.action === 'USER_RETROGRADED' ? 'Rétrogradation' :
                              log.action === 'ATTESTATION_VALIDATED' ? 'Validation' : 'Action'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            par {log.user?.name || log.user?.email} • <DateLocale date={log.timestamp} options={{ hour: '2-digit', minute: '2-digit' }} />
                          </p>
                          {log.newValue?.reason && (
                            <p className="text-[11px] mt-1 italic text-slate-600 font-medium">« {log.newValue.reason} »</p>
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
                    {/* Suppression LOGIQUE : motif obligatoire, attestation retirée
                        du vérificateur, preuve et audit conservés. */}
                    <div className="space-y-1.5">
                      <Button
                        variant="destructive"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={actionLoading}
                        className="w-full gap-2"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        Supprimer (logique)
                      </Button>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Retire l&apos;attestation du vérificateur public. Le PDF, le sceau et
                        l&apos;audit sont conservés. Un motif est obligatoire.
                      </p>
                    </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <SoftDeleteAttestationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        attestation={{ id, code: data.code, fullName: data.fullName, status: data.status }}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
