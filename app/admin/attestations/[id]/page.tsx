"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, Download, Edit, ArrowLeft, CheckCircle, XCircle, Clock, FileText, User, Calendar, MapPin, GraduationCap, Award, QrCode } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { QRCodeSVG } from "qrcode.react";

import { useQuery } from "@tanstack/react-query";
import CertificateTemplate from "@/components/CertificateTemplate";

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
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<AttestationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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
    fetch(`/api/attestations/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleStatus = async (status: "VALIDATED" | "REJECTED") => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/attestations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour");
      setData((prev) => prev ? { ...prev, status } : null);
      toast.success(status === "VALIDATED" ? "✅ Attestation validée !" : "❌ Attestation rejetée !");
    } catch (err: any) {
      toast.error(err.message || "Erreur inconnue");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette attestation ?")) return;
    try {
      const res = await fetch(`/api/attestations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      toast.success("Attestation supprimée !");
      router.push("/admin/attestations");
    } catch (err: any) {
      toast.error(err.message || "Erreur inconnue");
    }
  };

  const handleDownload = async () => {
    if (!data) return;
    const fileName = `${data.code.slice(-5)}_${data.fullName.replace(/\s+/g, '_')}.pdf`;
    
    toast.promise(
      (async () => {
        const html2pdf = (await import("html2pdf.js")).default;
        const element = document.getElementById("certificate-content"); // This is the ID in the CertificateTemplate
        if (!element) throw new Error("Template non trouvé");
        
        await html2pdf()
          .from(element)
          .set({ 
            margin: 0, 
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
          })
          .save();
      })(),
      {
        loading: 'Génération du diplôme officiel...',
        success: 'Téléchargement réussi !',
        error: 'Erreur lors de la génération.',
      }
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertTitle>Attestation non trouvée</AlertTitle>
            <AlertDescription>Cette attestation n'existe pas ou a été supprimée.</AlertDescription>
          </Alert>
          <Link href="/admin/attestations">
            <Button className="mt-4">← Retour à la liste</Button>
          </Link>
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
      case "REJECTED": return "Rejetée";
      default: return "En attente";
    }
  };

  const TypeIcon = getTypeIcon(data.type);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
          <div className="flex gap-2">
            <Link href={`/admin/attestations/${id}/edit`}>
              <Button variant="outline" className="gap-2">
                <Edit className="w-4 h-4" />
                Modifier
              </Button>
            </Link>
            <Button onClick={handleDownload} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Statut */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
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
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Award className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-700">Aperçu du contenu</span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">{data.id}</Badge>
            </div>

            {/* Corps minimaliste */}
            <div className="p-12 relative flex flex-col items-center text-center">
                {/* Filigrane discret */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
                    <Award size={400} />
                </div>

                <div className="relative z-10 space-y-8 max-w-2xl">
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] font-black text-blue-500">Document Officiel</p>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                            {data.type === "FORMATION" ? "Attestation de Formation" : 
                             data.type === "STAGE" ? "Certificat de Stage" : "Diplôme de Réussite"}
                        </h2>
                    </div>

                    <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 mx-auto rounded-full"></div>

                    <div className="py-6">
                        <p className="text-slate-500 text-sm mb-4">Ce document certifie le parcours de</p>
                        <p className="text-5xl font-black text-slate-800 tracking-tighter capitalize">
                            {data.fullName}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 text-left pt-6">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Formation / Projet</p>
                            <p className="font-bold text-slate-800 leading-tight">
                                {data.formation?.name || "Formation Professionnelle"}
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Période d'évaluation</p>
                            <p className="font-bold text-slate-800">
                                <DateLocale date={data.startDate} /> — <DateLocale date={data.endDate} />
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Évaluation finale</p>
                            <p className="font-bold text-emerald-600">
                                {data.type === "FORMATION" ? (data.certificationScore || 0) : (data.stageScore || 0)} / 100
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Volume horaire</p>
                            <p className="font-bold text-slate-800">
                                {data.type === "FORMATION" ? (data.certificationHours || 0) : (data.stageHours || 0)} Heures
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Template réel caché pour la génération PDF uniquement */}
            <div className="hidden">
                 <CertificateTemplate 
                    id="certificate-content"
                    settings={settings}
                    data={{
                        fullName: data.fullName,
                        formationName: data.formation?.name || "Formation Professionnelle",
                        code: data.code,
                        issuedAt: data.issuedAt,
                        startDate: data.startDate,
                        endDate: data.endDate,
                        score: data.type === "FORMATION" ? data.certificationScore : data.stageScore,
                        hours: data.type === "FORMATION" ? data.certificationHours : data.stageHours,
                        type: data.type,
                        gender: data.gender
                    }}
                />
            </div>
          </Card>

          {/* Informations et actions */}
          <div className="space-y-6">
            {/* QR Code */}
            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-slate-800">QR Code de vérification</h3>
              </div>
              <div className="flex justify-center">
                <QRCodeSVG 
                  value={`${window.location.origin}/verifier/${data.code}`}
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
                {data.status === "PENDING" && (
                  <>
                    <Button
                      onClick={() => handleStatus("VALIDATED")}
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
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
                <Button
                  onClick={handleDelete}
                  variant="destructive"
                  className="w-full gap-2"
                  disabled={actionLoading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Supprimer
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
