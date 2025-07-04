"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, FileDown, Printer } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { useRef } from "react";
import { QRCodeSVG } from 'qrcode.react';

export default function AttestationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const pdfRef = useRef(null);
  const [pdfMsg, setPdfMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/attestations/${id}`)
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((att) => setData(att))
      .catch(() => setError("Attestation non trouvée ou erreur serveur."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatus = async (status: 'VALIDATED' | 'REJECTED') => {
    setActionLoading(true);
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch(`/api/attestations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour du statut");
      const updated = await res.json();
      setData(updated);
      setActionMsg(status === 'VALIDATED' ? "Attestation validée !" : "Attestation rejetée.");
    } catch (e) {
      setActionError("Impossible de mettre à jour le statut.");
    } finally {
      setActionLoading(false);
    }
  };
  const handlePrint = () => {
    window.print();
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ton-domaine.com';

  const handleDownloadPDF = () => {
    setPdfMsg("");
    if (pdfRef.current) {
      html2pdf()
        .set({
          filename: `attestation-${data.code}.pdf`,
          margin: [4, 16, 4, 16],
          html2canvas: { scale: 2 },
          jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
          pagebreak: { mode: ['avoid-all'] }
        })
        .from(pdfRef.current)
        .save()
        .then(() => setPdfMsg("PDF téléchargé avec succès !"))
        .catch(() => setPdfMsg("Erreur lors de la génération du PDF."));
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full max-w-2xl mx-auto mt-12" />;
  }
  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error || "Attestation introuvable."}</AlertDescription>
        </Alert>
        <Button className="mt-6" onClick={() => router.push("/admin/attestations")}>Retour à la liste</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-3xl">📄</span>
          <h2 className="text-2xl font-bold">Détail de l'attestation</h2>
        </div>
        <div className="flex flex-wrap gap-4 mb-8">
          <Button
            variant="default"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleStatus('VALIDATED')}
            disabled={actionLoading || data.status === 'VALIDATED' || data.status === 'REJECTED'}
          >
            <CheckCircle className="w-4 h-4 mr-2" /> Valider
          </Button>
          <Button
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => handleStatus('REJECTED')}
            disabled={actionLoading || data.status === 'VALIDATED' || data.status === 'REJECTED'}
          >
            <XCircle className="w-4 h-4 mr-2" /> Rejeter
          </Button>
          <Button
            variant="outline"
            className="border-blue-600 text-blue-700"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4 mr-2" /> Imprimer / PDF
          </Button>
          <Button
            variant="outline"
            className="border-green-600 text-green-700"
            onClick={handleDownloadPDF}
          >
            <FileDown className="w-4 h-4 mr-2" /> Télécharger PDF
          </Button>
        </div>
        {pdfMsg && <Alert className="mb-4"><AlertTitle>{pdfMsg}</AlertTitle></Alert>}
        {actionMsg && <Alert className="mb-4"><AlertTitle>{actionMsg}</AlertTitle></Alert>}
        {actionError && <Alert variant="destructive" className="mb-4"><AlertTitle>{actionError}</AlertTitle></Alert>}
        <div ref={pdfRef} className="print:bg-white print:p-8 print:w-full print:landscape" style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 8px #0001', position: 'relative', overflow: 'hidden', padding: 16, margin: 4 }}>
          {/* Filigrane */}
          <div style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-20deg)',
            fontSize: 120,
            color: '#e5e7eb',
            opacity: 0.18,
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0
          }}>FSA</div>
          {/* Logo et bannière */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, zIndex: 1 }}>
            <img src="/logo-fsa.png" alt="Logo FSA" style={{ height: 64, marginRight: 16 }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb', letterSpacing: 1 }}>ATTESTATION OFFICIELLE</div>
              <div style={{ fontSize: 16, color: '#666', marginTop: 4 }}>Ferme Agro Piscicole St André</div>
            </div>
          </div>
          {/* Identité et code */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, zIndex: 1 }}>
            <div>
              <div style={{ fontSize: 14, color: '#888' }}>Code attestation</div>
              <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#2563eb' }}>{data.code}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, color: '#888' }}>Statut</div>
              <div style={{ fontWeight: 600, color: '#f59e42', fontSize: 16 }}>{data.status}</div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, marginBottom: 24, border: '1px solid #e5e7eb', zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>Délivré à</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#222', marginBottom: 8 }}>{data.fullName}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Né(e) le {new Date(data.birthDate).toLocaleDateString()} à {data.birthPlace}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Type : {data.type}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Période : du {new Date(data.startDate).toLocaleDateString()} au {new Date(data.endDate).toLocaleDateString()}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Lieu : {data.location}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Formateur : {data.instructor}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Société émettrice : {data.issuingCompany}</div>
          </div>
          {/* Détails formation */}
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 20, marginBottom: 24, border: '1px solid #bbf7d0', zIndex: 1 }}>
            <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 16, marginBottom: 4 }}>{data.formation?.name || '-'}</div>
            <div style={{ color: '#166534', fontSize: 14, marginBottom: 2 }}>Catégorie : {data.formation?.category || '-'}</div>
            <div style={{ color: '#166534', fontSize: 14, marginBottom: 2 }}>Description : {data.formation?.description || '-'}</div>
            <div style={{ color: '#166534', fontSize: 14 }}>Compétences : {Array.isArray(data.formation?.skills) ? data.formation.skills.join(', ') : '-'}</div>
          </div>
          {/* QR code et signature */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 32, zIndex: 1 }}>
            <div>
              <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Signature du responsable</div>
              <div style={{ width: 220, height: 40, borderBottom: '2px solid #aaa', marginBottom: 8 }}></div>
              <div style={{ fontSize: 13, color: '#888' }}>Date : {new Date(data.issuedAt).toLocaleDateString()}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <QRCodeSVG value={`${siteUrl}/verify/${data.code}`} size={80} level="M" includeMargin={true} />
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Vérification</div>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push("/admin/attestations")}>Retour à la liste</Button>
      </Card>
    </div>
  );
}
