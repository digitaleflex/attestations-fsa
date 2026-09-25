"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, QrCode, Share2, ShieldCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import OfficialDocument from "@/components/OfficialDocument";
import { toast } from "sonner";
import {
  attestationVerificationPath,
  isOfficialPdfDownloadable,
  startOfficialPdfDownload,
} from "@/lib/attestations/client-download";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, FileQuestion } from "lucide-react";
import {
  CandidateEmptyState,
  CandidateErrorState,
  CandidateLoading,
} from "@/components/CandidateStates";

/** 404 : le document n'existe pas — état vide, aucun retry inutile. */
class AttestationNotFoundError extends Error {
  constructor() {
    super("Attestation introuvable");
    this.name = "AttestationNotFoundError";
  }
}

/** Retour vers la liste des attestations, réutilisé par tous les états. */
function BackLink() {
  return (
    <Link href="/attestations">
      <Button
        variant="outline"
        size="sm"
        className="rounded-full gap-2"
        // `aria-label` explicite : le libellé visible ne doit pas être la seule
        // source du nom accessible (traductions, modes reduits, lecteurs).
        aria-label="Retour à mes attestations"
      >
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        Retour à mes attestations
      </Button>
    </Link>
  );
}

/**
 * Page d'aperçu d'attestation pour le candidat
 */

export default function AttestationPreviewPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  
  // Correction Form State
  const [field, setField] = useState("fullName");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  const { data: att, isLoading, isError, error: attError, isFetching, refetch } = useQuery({
    queryKey: ["user-attestation", id],
    queryFn: async () => {
      const res = await fetch(`/api/attestations/${id}`);
      if (res.status === 404) {
        throw new AttestationNotFoundError();
      }
      if (!res.ok) throw new Error("Attestation non trouvée");
      return res.json();
    },
    retry: 1,
  });

  // #258 : aucun PDF n'est fabriqué ici. Le document affiché est un simple
  // aperçu ; le fichier téléchargé est la version serveur, scellée et stockée.
  const handleDownload = () => {
    if (!att || !isOfficialPdfDownloadable(att.status)) {
      toast.error("Ce document n'est pas encore disponible au téléchargement.");
      return;
    }
    setIsDownloading(true);
    try {
      if (!startOfficialPdfDownload(att.code)) {
        toast.error("Le téléchargement a été bloqué par le navigateur : autorisez les pop-ups pour ce site.");
        return;
      }
      toast.success("Téléchargement du document officiel lancé.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue) {
      toast.error("Veuillez saisir la nouvelle valeur");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/user/attestations/${id}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, newValue, reason }),
      });

      if (!res.ok) throw new Error("Erreur");
      
      toast.success("Demande envoyée ! Un administrateur va l'étudier.");
      setOpen(false);
      setNewValue("");
      setReason("");
    } catch (error) {
      toast.error("Erreur lors de l'envoi de la demande");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      // Zone de chargement annoncée : `role="status"` + `aria-live="polite"`
      // (lu sans interrompre la navigation) et `aria-busy="true"` tant que le
      // document n'est pas là. `CandidateLoading` porte le rendu visuel et son
      // propre libellé ; ce wrapper est la région annoncée au niveau de la page.
      <div role="status" aria-live="polite" aria-busy="true">
        <CandidateLoading
          label="Chargement du document officiel…"
          className="py-24 justify-center"
        />
      </div>
    );
  }

  // Erreur de chargement : l'utilisateur doit pouvoir relancer, et savoir
  // qu'il ne s'agit pas d'un document « vide ».
  if (isError || !att) {
    // 404 : ce n'est pas une panne, proposer un retry serait trompeur.
    if (attError instanceof AttestationNotFoundError) {
      return (
        <div className="space-y-6 max-w-3xl mx-auto">
          <BackLink />
          <CandidateEmptyState
            icon={
              <FileQuestion
                className="h-8 w-8 text-slate-500"
                aria-hidden="true"
              />
            }
            title="Document introuvable"
            description="Cette attestation n'existe pas ou n'est plus accessible. Elle est peut-être verrouillée jusqu'à la délibération finale."
            primaryAction={{
              label: "Voir mes attestations",
              onClick: () => router.push("/attestations"),
            }}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <BackLink />
        <CandidateErrorState
          title="Impossible d'ouvrir ce document"
          description="Le document n'a pas pu être récupéré : connexion instable, session expirée ou document inaccessible. Réessayez, ou revenez à la liste de vos attestations."
        />
        {/* Relance portée par la page : le libellé d'attente dépend de
            `isFetching` et le bouton reste atteignable au clavier sous le
            message d'erreur. */}
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-busy={isFetching}
            className="min-h-[44px] gap-2 rounded-xl border-rose-200 font-bold text-rose-700 hover:bg-rose-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {isFetching ? "Nouvelle tentative…" : "Réessayer"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header Mobile-friendly */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <Link href="/attestations">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              // Bouton icône seule : sans `aria-label`, il n'a pas de nom
              // accessible du tout.
              aria-label="Retour à mes attestations"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Aperçu officiel</h1>
            <p className="text-xs text-slate-500 font-mono">{att.code}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleDownload}
            disabled={isDownloading || !isOfficialPdfDownloadable(att.status)}
            aria-busy={isDownloading}
            className="flex-1 md:flex-none bg-brand hover:bg-brand-dark gap-2"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Télécharger (PDF)
          </Button>
        </div>
      </div>

      {/* Zone de Certificat (Paysage) */}
      <Card className="overflow-hidden bg-slate-50 border-none shadow-2xl transition-all duration-500 hover:shadow-brand/10">
        <div className="p-4 md:p-8 flex justify-center">
             <div className="w-full max-w-[1000px] shadow-2xl origin-top transition-transform">
                 <OfficialDocument
                     id={`attestation-preview-${att.id}`}
                     hideStepper
                     data={{
                        id: att.id,
                        code: att.code,
                        fullName: att.fullName,
                        formationName: att.formation?.name || "Formation Saint André",
                        type: att.type,
                        startDate: att.startDate,
                        endDate: att.endDate,
                        score: att.type === "FORMATION" ? (att.certificationScore || 0) : (att.stageScore || 0),
                        status: att.status,
                        issuedAt: att.issuedAt
                    }}
                />
             </div>
        </div>
      </Card>

      {/* Info & Sécurité */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-white border border-slate-100 italic text-slate-600 text-sm flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            <div>
                <p className="font-bold text-slate-800 mb-1">Document Certifié</p>
                Ce certificat est un exemplaire officiel émis par la Ferme Saint André. 
                Il est protégé contre les falsifications et peut être vérifié en temps réel via son code unique.
            </div>
        </Card>
        
        <Card className="p-4 sm:p-6 bg-white border border-slate-100 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-5 h-5 text-brand" />
                </div>
                <div className="min-w-0">
                   <p className="font-bold text-slate-800">Partageable</p>
                   <p className="text-slate-500 text-xs sm:text-sm">Un recruteur peut scanner cette attestation.</p>
                </div>
            </div>
            <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:justify-end">
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="flex-1 sm:flex-none gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-2 sm:px-3 h-10 sm:h-9" aria-label={`Signaler une erreur sur l'attestation ${att.code}`}>
                            <AlertTriangle className="w-4 h-4" />
                            <span className="sm:hidden lg:inline text-xs sm:text-sm">Signaler</span>
                            <span className="hidden sm:inline lg:hidden">Signaler</span>
                        </Button>
                    </DialogTrigger>
                    {/* ... (DialogContent reste inchangé) */}
                    <DialogContent className="sm:max-w-md">
                        <form onSubmit={handleCorrectionSubmit}>
                            <DialogHeader>
                                <DialogTitle>Signaler une erreur</DialogTitle>
                                <DialogDescription>
                                    Votre attestation contient une erreur ? Indiquez-nous les corrections à apporter.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="field">Champ à corriger</Label>
                                    <Select value={field} onValueChange={setField}>
                                        <SelectTrigger id="field">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fullName">Nom Complet</SelectItem>
                                            <SelectItem value="birthDate">Date de Naissance</SelectItem>
                                            <SelectItem value="birthPlace">Lieu de Naissance</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="newValue">Valeur correcte</Label>
                                    <Input 
                                        id="newValue" 
                                        placeholder={field === 'fullName' ? 'Ex: Jean Dupont' : field === 'birthDate' ? 'Ex: 1990-01-01' : 'Ex: Cotonou'}
                                        type={field === 'birthDate' ? 'date' : 'text'}
                                        v-model="newValue"
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        required 
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="reason">Motif (Optionnel)</Label>
                                    <Textarea 
                                        id="reason" 
                                        placeholder="Pourquoi souhaitez-vous cette correction ?"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                      />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Envoi..." : "Envoyer la demande"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none gap-2 h-10 sm:h-9 px-2 sm:px-3" aria-label={`Copier le lien de vérification de l'attestation ${att.code}`} onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}${attestationVerificationPath(att.code)}`);
                    toast.success("Lien de vérification copié !");
                }}>
                    <Share2 className="w-4 h-4" />
                    <span className="text-xs sm:text-sm whitespace-nowrap">Copier</span>
                </Button>
            </div>
        </Card>
      </div>
    </div>
  );
}
