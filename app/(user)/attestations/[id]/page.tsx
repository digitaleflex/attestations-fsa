"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, QrCode, Share2, ShieldCheck, Printer } from "lucide-react";
import Link from "next/link";
import CertificateTemplate from "@/components/CertificateTemplate";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const html2pdf = dynamic(() => import("html2pdf.js"), { ssr: false });

export default function AttestationPreviewPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: att, isLoading } = useQuery({
    queryKey: ["user-attestation", id],
    queryFn: async () => {
      const res = await fetch(`/api/attestations/${id}`);
      if (!res.ok) throw new Error("Attestation non trouvée");
      return res.json();
    }
  });

  const handleDownload = async () => {
    if (!att) return;
    toast.info("Génération du document...");
    
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById(`cert-template-${att.id}`);
      
      const opt = {
        margin: 0,
        filename: `Attestation_FSA_${att.code}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("Téléchargement réussi !");
    } catch (e) {
      toast.error("Erreur de génération");
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center">Chargement...</div>;
  if (!att) return <div className="p-8 text-center">Document introuvable</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header Mobile-friendly */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <Link href="/attestations">
            <Button variant="ghost" size="sm" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Aperçu officiel</h1>
            <p className="text-xs text-slate-500 font-mono">{att.code}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleDownload} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Download className="w-4 h-4" />
            Télécharger (PDF)
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="hidden md:flex gap-2">
            <Printer className="w-4 h-4" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* Zone de Certificat (Paysage) */}
      <Card className="overflow-hidden bg-slate-50 border-none shadow-2xl transition-all duration-500 hover:shadow-emerald-500/10">
        <div className="p-4 md:p-8 flex justify-center">
             <div className="w-full max-w-[1000px] shadow-2xl origin-top transition-transform">
                <CertificateTemplate 
                    id={`cert-template-${att.id}`}
                    data={{
                        fullName: att.fullName,
                        formationName: att.formation?.name || "Formation Professionnelle",
                        code: att.code,
                        issuedAt: att.issuedAt,
                        startDate: att.startDate,
                        endDate: att.endDate,
                        score: att.type === "FORMATION" ? att.certificationScore : att.stageScore,
                        hours: att.type === "FORMATION" ? att.certificationHours : att.stageHours,
                        type: att.type,
                        gender: att.gender
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
        
        <Card className="p-6 bg-white border border-slate-100 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
                <QrCode className="w-6 h-6 text-blue-500" />
                <div>
                   <p className="font-bold text-slate-800">Partageable</p>
                   <p className="text-slate-500">Un recruteur peut scanner ce diplôme.</p>
                </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/verifier/${att.code}`);
                toast.success("Lien de vérification copié !");
            }}>
                <Share2 className="w-4 h-4" />
                Copier le lien
            </Button>
        </Card>
      </div>
    </div>
  );
}
