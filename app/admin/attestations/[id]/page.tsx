"use client";

import * as React from "react"
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, FileDown, Printer } from 'lucide-react';
// import html2pdf from 'html2pdf.js'; // Dynamically imported
import { useRef } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { toast } from "sonner";

// Composant utilitaire pour afficher une date formatée côté client uniquement
function DateLocale({ date, options }: { date: string | Date, options?: Intl.DateTimeFormatOptions }) {
  const [formatted, setFormatted] = useState("");
  useEffect(() => {
    if (date) {
      setFormatted(new Date(date).toLocaleDateString('fr-FR', options));
    }
  }, [date, options]);
  return <span>{formatted}</span>;
}

type Attestation = {
  code: string;
  status: string;
  fullName: string;
  birthDate: string;
  birthPlace: string;
  type: string;
  startDate: string;
  endDate: string;
  location: string;
  instructor: string;
  issuingCompany: string;
  issuedAt: string;
  formation?: {
    name?: string;
    category?: string;
    description?: string;
    skills?: string[];
  };
};

export default function AttestationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Attestation | null>(null);
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

  // Déclenchement auto du PDF si ?pdf=1
  useEffect(() => {
    if (!loading && data && searchParams.get("pdf") === "1") {
      setTimeout(() => handleDownloadPDF(), 400);
    }

  }, [loading, data, searchParams]);

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      setActionError("Impossible de mettre à jour le statut.");
    } finally {
      setActionLoading(false);
    }
  };
  const handlePrint = () => {
    window.print();
  };


  const handleDownloadPDF = async () => {
    setPdfMsg("");
    if (!data || !pdfRef.current) return;

    try {
      setPdfMsg("Préparation du PDF...");
      // Dynamic import for performance
      const html2pdf = (await import('html2pdf.js')).default;

      await html2pdf()
        .set({
          filename: `attestation-${data.code}.pdf`,
          margin: [4, 16, 4, 16],
          html2canvas: { scale: 2 },
          jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
          pagebreak: { mode: ['avoid-all'] }
        })
        .from(pdfRef.current)
        .save();

      setPdfMsg("PDF téléchargé avec succès !");
    } catch (error) {
      console.error(error);
      setPdfMsg("Erreur lors de la génération du PDF.");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copié !");
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
          <h2 className="text-2xl font-bold">Détail de l&rsquo;attestation</h2>
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
            <img src="/logo-fsa.png" alt="Logo FSA" width={64} height={64} style={{ marginRight: 16 }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb', letterSpacing: 1 }}>ATTESTATION OFFICIELLE</div>
              <div style={{ fontSize: 16, color: '#666', marginTop: 4 }}>Ferme Agro Piscicole St André</div>
            </div>
          </div>
          {/* Identité et code */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, zIndex: 1 }}>
            <div>
              <div style={{ fontSize: 14, color: '#888' }}>Code attestation</div>
              <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                {data.code}
                {/* Bouton de copie supprimé */}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, color: '#888' }}>Statut</div>
              <div style={{ fontWeight: 600, color: '#f59e42', fontSize: 16 }}>{data.status}</div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, marginBottom: 24, border: '1px solid #e5e7eb', zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>Délivré à</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#222', marginBottom: 8 }}>{data.fullName}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Né(e) le <DateLocale date={data.birthDate} /> à {data.birthPlace}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Type : {data.type}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Période : du <DateLocale date={data.startDate} /> au <DateLocale date={data.endDate} /></div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Lieu : {data.location}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Formateur : {data.instructor}</div>
            <div style={{ fontSize: 15, color: '#444', marginBottom: 4 }}>Société émettrice : {data.issuingCompany}</div>
          </div>
          {/* Détails formation */}
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 24, marginBottom: 32, border: '1px solid #bbf7d0', zIndex: 1 }}>
            <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 18, marginBottom: 12, letterSpacing: 0.5 }}>{data.formation?.name || '-'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, color: '#166534', marginBottom: 4 }}>
                <span style={{ fontWeight: 700 }}>Catégorie :</span> {data.formation?.category || '-'}
              </div>
              <div style={{ fontSize: 15, color: '#166534', marginBottom: 4 }}>
                <span style={{ fontWeight: 700 }}>Description :</span> {data.formation?.description || '-'}
              </div>
              <div style={{ fontSize: 15, color: '#166534' }}>
                <span style={{ fontWeight: 700 }}>Compétences :</span>{' '}
                {data.formation && Array.isArray(data.formation.skills) ? data.formation.skills.join(', ') : '-'}
              </div>
            </div>
          </div>
          {/* QR code et signature */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 32, zIndex: 1 }}>
            <div>
              <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Signature du responsable</div>
              <div style={{ width: 260, height: 60, borderBottom: '2px solid #b91c1c', marginBottom: 8, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <img
                  src="/signature-responsable.png"
                  alt="Signature du responsable"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                  }}
                />
              </div>
              <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>Date : <DateLocale date={data.issuedAt} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <QRCodeSVG value={`https://verifier.fermestandre.com/${data.code}`} size={80} level="M" includeMargin={true} />
              <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 4, fontWeight: 700 }}>
                Vérification
              </div>
            </div>
          </div>
          {/* Formule officielle */}
          <div style={{ marginTop: 18, textAlign: 'center', color: '#111', fontSize: 11, fontStyle: 'italic', lineHeight: 1.35, fontFamily: 'Georgia, Times, serif', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto', letterSpacing: 0.01 }}>
            La présente attestation est établie en toute bonne foi, sous la responsabilité de <span style={{ fontWeight: 700, color: '#b91c1c' }}>LA FERME AGRO PISCICOLE ST ANDRE</span>, pour servir et faire valoir ce que de droit auprès de toute autorité ou organisme qui en fera la demande. Toute altération ou falsification de ce document expose son auteur à des poursuites conformément à la loi.<br />
            <span style={{ fontWeight: 700 }}>
              Fait à Abomey-Calavi, le <DateLocale date={data.issuedAt} options={{ day: 'numeric', month: 'long', year: 'numeric' }} />.
            </span>
          </div>
          {/* Encadré informations légales & contact */}
          <div style={{
            marginTop: 10,
            padding: 8,
            border: '1px solid #b91c1c',
            borderRadius: 6,
            background: '#fff',
            fontSize: 10,
            color: '#111',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontWeight: 500,
            boxShadow: '0 1px 4px #0001',
            maxWidth: 380,
            marginLeft: 'auto',
            marginRight: 'auto',
            textAlign: 'center',
            lineHeight: 1.35,
            letterSpacing: 0.01
          }}>
            Cette attestation est strictement personnelle et ne peut être cédée à un tiers.<br />
            Pour toute vérification, contactez : <a href="mailto:security@fermestandre.com" style={{ color: '#b91c1c', textDecoration: 'underline' }}>security@fermestandre.com</a>
            <div style={{ fontSize: 9, color: '#b91c1c', marginTop: 4, fontWeight: 600, textAlign: 'center', letterSpacing: 0.01 }}>
              Vérifiez l’authenticité de ce document sur verifier.fermestandre.com
            </div>
          </div>
        </div>
        {/* Pied de page vérification */}
        <div style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#b91c1c',
          marginTop: 24,
          fontWeight: 500,
          letterSpacing: 0.5,
          fontFamily: 'Arial, Helvetica, sans-serif',
          opacity: 0.85
        }}>
          Vérifiez l’authenticité de ce document sur <span style={{ fontWeight: 700 }}>verifier.fermestandre.com</span>
        </div>
        <Button variant="outline" onClick={() => router.push("/admin/attestations")}>Retour à la liste</Button>
      </Card>
    </div>
  );
}
