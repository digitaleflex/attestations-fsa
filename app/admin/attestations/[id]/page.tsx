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

  const handleDownload = () => {
    const element = document.getElementById("attestation-preview");
    if (!element) return;
    html2pdf()
      .from(element)
      .set({ margin: 10, filename: `attestation-${data?.code}.pdf` })
      .save();
    toast.success("PDF téléchargé !");
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
          {/* Aperçu de l'attestation */}
          <Card className="lg:col-span-2 p-8 bg-white shadow-lg">
            <div id="attestation-preview" className="p-8 bg-white border-2 border-slate-200">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-800">ATTESTATION DE {data.type}</h1>
                <p className="text-slate-600 mt-2 font-mono text-sm">{data.code}</p>
              </div>

              <div className="space-y-4 text-slate-700">
                <p className="text-lg">
                  Je soussigné(e), la direction de <strong>{data.issuingCompany}</strong>, atteste que :
                </p>
                <p className="text-xl font-semibold text-center my-6">
                  {data.gender === "F" ? "Mme " : data.gender === "M" ? "M. " : ""}{data.fullName}
                </p>
                <p style={{ fontSize: 15, color: "#444", marginBottom: 4 }}>
                  Né(e) le <DateLocale date={data.birthDate} /> à <strong>{data.birthPlace}</strong>
                </p>
                <p className="text-lg">
                  A suivi avec succès la formation <strong>{data.formation?.name || "-"}</strong>
                </p>
                <p style={{ fontSize: 15, color: "#444", marginBottom: 4 }}>
                  Période : du <DateLocale date={data.startDate} /> au <DateLocale date={data.endDate} />
                </p>
                <p style={{ fontSize: 15, color: "#444" }}>
                  Lieu : <strong>{data.location}</strong>
                </p>
                <p style={{ fontSize: 15, color: "#444" }}>
                  Formateur : <strong>{data.instructor}</strong>
                </p>
                
                {/* Informations spécifiques */}
                {data.type === "STAGE" && data.stageHours && (
                  <p style={{ fontSize: 15, color: "#444" }}>
                    Durée du stage : <strong>{data.stageHours} heures</strong>
                    {data.stageScore && ` - Score: ${data.stageScore}/100`}
                  </p>
                )}
                {data.type === "CERTIFICATION" && (
                  <>
                    {data.certificationHours && (
                      <p style={{ fontSize: 15, color: "#444" }}>
                        Durée : <strong>{data.certificationHours} heures</strong>
                      </p>
                    )}
                    {data.certificationMention && (
                      <p style={{ fontSize: 15, color: "#444" }}>
                        Mention : <strong>{data.certificationMention}</strong>
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="mt-12 pt-8 border-t-2 border-slate-300">
                <div className="flex justify-between items-end">
                  <div>
                    <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>
                      Statut :{" "}
                      <span className={
                        data.status === "VALIDATED" ? "text-emerald-600" :
                        data.status === "REJECTED" ? "text-rose-600" : "text-amber-600"
                      }>
                        {data.status === "VALIDATED" ? "VALIDÉE" :
                         data.status === "REJECTED" ? "REJETÉE" : "EN ATTENTE"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>
                      Date : <DateLocale date={data.issuedAt} options={{ day: "numeric", month: "long", year: "numeric" }} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-slate-800 w-48 mx-auto mb-2"></div>
                    <div className="text-sm font-semibold">La Direction</div>
                    <div className="text-xs text-slate-500">{data.issuingCompany}</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
                Fait à {data.location.split(",")[0] || "Abomey-Calavi"}, le{" "}
                <DateLocale date={data.issuedAt} options={{ day: "numeric", month: "long", year: "numeric" }} />.
              </div>
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
