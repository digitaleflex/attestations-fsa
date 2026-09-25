"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, QrCode, Share2, ShieldCheck, Printer, Loader2, RotateCcw, FileText } from "lucide-react";
import Link from "next/link";
import OfficialDocument from "@/components/OfficialDocument";
import { toast } from "sonner";
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
import { AlertTriangle } from "lucide-react";
/**
 * Page d'aperçu d'attestation pour le candidat
 */

export default function AttestationPreviewPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  
  // Correction Form State
  const [field, setField] = useState("fullName");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  const { data: att, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["user-attestation", id],
    queryFn: async () => {
      const res = await fetch(`/api/attestations/${id}`);
      if (res.status === 404) throw new Error("NOT_FOUND");
      if (!res.ok) throw new Error("Impossible de charger cette attestation");
      return res.json();
    },
    retry: false
  });

  const notFound = error instanceof Error && error.message === "NOT_FOUND";

  const handleDownload = async () => {
    if (!att) return;
    
    const fileName = `${att.code.slice(-5)}_${att.fullName.replace(/\s+/g, '_')}.pdf`;

    toast.promise(
      (async () => {
        try {
          // 1. Activer le mode impression pour la largeur fixe
          setIsPrinting(true);
          
          // 2. Laisser un temps pour le re-render
          await new Promise(resolve => setTimeout(resolve, 500));

          // 3. Importer la librairie côté client
          const html2pdf = (await import("html2pdf.js")).default;
          const element = document.getElementById(`cert-template-${att.id}`);
          
          if (!element) {
              throw new Error("Aperçu du certificat non trouvé dans le DOM");
          }

          const opt = {
            margin: 0,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
              scale: 2, 
              useCORS: true, 
              letterRendering: true,
              width: 1120,
              windowWidth: 1120
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
          };

          // 4. Générer et sauvegarder le PDF
          await html2pdf().set(opt).from(element).save();
        } catch (error: any) {
          console.error("PDF Generation Error:", error);
          throw error;
        } finally {
          // 5. Toujours désactiver le mode impression, même en cas d'erreur
          setIsPrinting(false);
        }
      })(),
      {
        loading: 'Génération de votre document officiel...',
        success: 'Téléchargement réussi !',
        error: 'Erreur lors du téléchargement. Veuillez réessayer.',
      }
    );
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

  /* ── États de la page ────────────────────────────────────────────────
     Chargement, erreur réseau (avec relance) et document absent sont trois
     écrans distincts et annoncés aux technologies d'assistance : avant, un
     simple texte « Document introuvable » s'affichait aussi après un échec
     réseau, sans rien pour relancer la requête. */
  if (isLoading) {
    return (
      <div
        className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 aria-hidden="true" className="w-10 h-10 animate-spin text-brand" />
        <p className="text-sm font-bold uppercase tracking-widest text-slate-600">
          Ouverture de votre document officiel…
        </p>
      </div>
    );
  }

  if (isError || !att) {
    return (
      <div className="max-w-xl mx-auto py-16">
        <Card
          role="alert"
          className="p-10 sm:p-12 bg-white border border-slate-100 shadow-xl shadow-slate-200/50 rounded-[2.5rem] text-center flex flex-col items-center"
        >
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
              notFound ? "bg-slate-50 border border-slate-200" : "bg-rose-50 border border-rose-100"
            }`}
          >
            {notFound ? (
              <FileText aria-hidden="true" className="w-9 h-9 text-slate-500" />
            ) : (
              <AlertTriangle aria-hidden="true" className="w-9 h-9 text-rose-600" />
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
            {notFound ? "Document introuvable" : "Impossible d'ouvrir ce document"}
          </h1>
          <p className="text-sm font-medium text-slate-600 max-w-md leading-relaxed">
            {notFound
              ? "Cette attestation n'existe pas, a été supprimée, ou n'est pas associée à votre compte."
              : "La communication avec nos serveurs a échoué. Vérifiez votre connexion internet puis réessayez."}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 w-full sm:w-auto">
            {!notFound && (
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                className="bg-brand hover:bg-brand-dark text-white rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-xs gap-2 w-full sm:w-auto"
              >
                {isFetching ? (
                  <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw aria-hidden="true" className="w-4 h-4" />
                )}
                {isFetching ? "Nouvelle tentative…" : "Réessayer"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push("/attestations")}
              className="rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-xs w-full sm:w-auto"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              Mes attestations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header Mobile-friendly */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <Link href="/attestations">
            <Button variant="ghost" size="sm" className="rounded-full" aria-label="Retour à mes attestations">
              <ArrowLeft aria-hidden="true" className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Aperçu officiel</h1>
            <p className="text-xs text-slate-600 font-mono break-all">{att.code}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleDownload} className="flex-1 md:flex-none bg-brand hover:bg-brand-dark gap-2">
            <Download aria-hidden="true" className="w-4 h-4" />
            Télécharger (PDF)
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="hidden md:flex gap-2">
            <Printer aria-hidden="true" className="w-4 h-4" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* Zone de Certificat (Paysage) */}
      <Card className="overflow-hidden bg-slate-50 border-none shadow-2xl transition-all duration-500 hover:shadow-brand/10">
        <div className="p-4 md:p-8 flex justify-center">
             <div className="w-full max-w-[1000px] shadow-2xl origin-top transition-transform">
                <OfficialDocument 
                    id={`cert-template-${att.id}`}
                    isPrinting={isPrinting}
                    hideStepper={isPrinting}
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
            <ShieldCheck aria-hidden="true" className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
                <p className="font-bold text-slate-800 mb-1 not-italic">Document Certifié</p>
                Ce certificat est un exemplaire officiel émis par la Ferme Saint André. 
                Il est protégé contre les falsifications et peut être vérifié en temps réel via son code unique.
            </div>
        </Card>
        
        <Card className="p-4 sm:p-6 bg-white border border-slate-100 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <QrCode aria-hidden="true" className="w-5 h-5 text-brand" />
                </div>
                <div className="min-w-0">
                   <p className="font-bold text-slate-800">Partageable</p>
                   <p className="text-slate-600 text-xs sm:text-sm">Un recruteur peut scanner cette attestation.</p>
                </div>
            </div>
            <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:justify-end">
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 sm:flex-none gap-2 text-rose-700 hover:text-rose-800 hover:bg-rose-50 px-2 sm:px-3 h-10 sm:h-9"
                            aria-label={`Signaler une erreur sur l'attestation ${att.code}`}
                        >
                            <AlertTriangle aria-hidden="true" className="w-4 h-4" />
                            <span className="text-xs sm:text-sm">Signaler</span>
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
                                    {isSubmitting ? "Envoi…" : "Envoyer la demande"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none gap-2 h-10 sm:h-9 px-2 sm:px-3" aria-label={`Copier le lien de vérification de l'attestation ${att.code}`} onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/verifier?code=${encodeURIComponent(att.code)}`);
                    toast.success("Lien de vérification copié !");
                }}>
                    <Share2 aria-hidden="true" className="w-4 h-4" />
                    <span className="text-xs sm:text-sm whitespace-nowrap">Copier</span>
                </Button>
            </div>
        </Card>
      </div>
    </div>
  );
}
