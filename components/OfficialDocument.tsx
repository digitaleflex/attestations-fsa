"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttestationWatermark } from "@/components/AttestationWatermark";

interface PublishedDocumentData {
  id: string;
  code: string;
  fullName: string;
  formationName: string;
  type: string;
  startDate: string | Date;
  endDate: string | Date;
  score: number;
  status: string;
  issuedAt: string | Date;
}

interface RevokedDocumentData {
  code: string;
  status: "REJECTED";
}

interface OfficialDocumentProps {
  data: PublishedDocumentData | RevokedDocumentData;
  id?: string;
  hideStepper?: boolean;
  isPrinting?: boolean;
}

/* Palette du document — contraste vérifié sur fond blanc / #f8fafc (WCAG AA).
   `#475569` (7,2:1) remplace `#64748b` (4,6:1) qui était trop juste pour les
   libellés 9-10 px ; `#64748b` (4,8:1) remplace `#94a3b8` (2,5:1) du stepper. */
const INK = "#0f172a";
const INK_SOFT = "#1e293b";
const MUTED = "#475569";
const MUTED_ON_WHITE = "#64748b";

export default function OfficialDocument({ data, id = "official-document-content", hideStepper = false, isPrinting = false }: OfficialDocumentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatDate = (d: string | Date) => {
    if (!mounted) return "--/--/----";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const statusConfig = {
    VALIDATED: { label: "ADMIS", color: "#059669", bg: "#ecfdf5", icon: CheckCircle },
    CLAIMED: { label: "RÉCUPÉRÉE", color: "#2563eb", bg: "#eff6ff", icon: BadgeCheck },
    REJECTED: { label: "REFUSÉ", color: "#dc2626", bg: "#fef2f2", icon: XCircle },
    PENDING: { label: "EN ATTENTE", color: "#b45309", bg: "#fffbeb", icon: Clock },
  };

  const currentStatus = statusConfig[data.status as keyof typeof statusConfig] || statusConfig.PENDING;

  // Une révocation est affichée sans reprendre les données du titulaire.
  // Le retour public peut donc légitimement ne contenir que le statut et le code.
  if (!("fullName" in data)) {
    return (
      <div
        id={id}
        className="@container w-full min-h-[420px] flex flex-col items-center justify-center p-6 sm:p-8 text-center rounded-[12px] border-8 border-white bg-white"
        style={{ boxShadow: "0 0 0 1px #e2e8f0, 0 0 0 4px #dc2626" }}
      >
        <XCircle aria-hidden="true" className="w-14 h-14 mb-6 @lg:w-16 @lg:h-16" style={{ color: "#dc2626" }} />
        <p className="text-2xl @lg:text-3xl font-black tracking-[0.15em] @lg:tracking-[0.2em] uppercase" style={{ color: "#dc2626" }}>
          Attestation révoquée
        </p>
        <p className="mt-4 text-sm font-medium" style={{ color: MUTED }}>Ce document n&apos;est plus valable.</p>
        {data.code && <p className="mt-6 font-mono text-xs font-bold break-all" style={{ color: INK_SOFT }}>CODE : {data.code}</p>}
      </div>
    );
  }

  /* Toutes les tailles ci-dessous sont pilotées par une CONTAINER QUERY
     (`@container`, puis `@lg:` = 512 px et `@3xl:` = 768 px) et non par la
     largeur du viewport. La racine du document porte elle-même `@container` :
     en mode impression elle est figée à 1120 px, donc les deux paliers sont
     franchis et le rendu A4 est strictement identique à l'existant, quel que
     soit l'écran. Seul un document réellement étroit (téléphone) bascule sur
     le résumé compact. */
  const nameSize =
    data.fullName.length > 40
      ? "text-xl @lg:text-3xl @3xl:text-4xl"
      : data.fullName.length > 25
        ? "text-2xl @lg:text-4xl @3xl:text-5xl"
        : "text-3xl @lg:text-5xl @3xl:text-6xl";

  return (
    <div className="@container w-full flex flex-col items-center">
        {!hideStepper && (
            <div className="w-full max-w-sm mb-6 @lg:mb-12 flex items-center justify-between relative no-pdf">
                <div aria-hidden="true" className="absolute top-4 left-0 w-full h-[1px] -z-0" style={{ backgroundColor: '#e2e8f0' }} />

                {/* Étape 1: Création */}
                <div className="flex flex-col items-center gap-2 z-10">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-sm" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>1</div>
                    <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: MUTED_ON_WHITE }}>Création</span>
                </div>

                {/* Étape 2: Examen Jury */}
                <div className="flex flex-col items-center gap-2 z-10">
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-sm transition-all duration-500",
                        data.status === "PENDING" ? "animate-pulse" : ""
                    )} style={{
                        backgroundColor: data.status === "PENDING" ? "#f59e0b" :
                                        (data.status === "VALIDATED" || data.status === "REJECTED") ? "#10b981" : "#f1f5f9",
                        color: (data.status === "PENDING" || data.status === "VALIDATED" || data.status === "REJECTED") ? "#ffffff" : MUTED_ON_WHITE
                    }}>
                        { (data.status === "VALIDATED" || data.status === "REJECTED") ? "✓" : "2" }
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: MUTED_ON_WHITE }}>Examen</span>
                </div>

                {/* Étape 3: Décision */}
                <div className="flex flex-col items-center gap-2 z-10">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-sm transition-all duration-500" style={{
                        backgroundColor: data.status === "VALIDATED" ? "#059669" :
                                        data.status === "REJECTED" ? "#dc2626" : "#f1f5f9",
                        color: (data.status === "VALIDATED" || data.status === "REJECTED") ? "#ffffff" : MUTED_ON_WHITE
                    }}>
                        { data.status === "VALIDATED" ? "✓" : data.status === "REJECTED" ? "✕" : "3" }
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: MUTED_ON_WHITE }}>Décision</span>
                </div>
            </div>
        )}

        {/* Le Document Officiel (Minimaliste) */}
        <div
          id={id}
          className={cn(
            "@container flex flex-col items-center rounded-[12px] relative overflow-hidden transition-all duration-300",
            isPrinting ? "w-[1120px] min-w-[1120px] h-[790px] max-h-[790px] overflow-hidden" : "w-full shadow-2xl shadow-slate-200"
          )}
          style={{ 
              border: "8px solid #ffffff",
              boxShadow: "0 0 0 1px #e2e8f0, 0 0 0 3px #ffffff, 0 0 0 4px #2563eb",
              backgroundColor: "#ffffff"
          }}
        >
            {/* Accents de coins stylés — purement décoratifs */}
            <div aria-hidden="true" className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 rounded-tl-lg" style={{ borderColor: '#2563eb', opacity: 0.2 }}></div>
            <div aria-hidden="true" className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 rounded-tr-lg" style={{ borderColor: '#2563eb', opacity: 0.2 }}></div>
            <div aria-hidden="true" className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 rounded-bl-lg" style={{ borderColor: '#2563eb', opacity: 0.2 }}></div>
            <div aria-hidden="true" className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 rounded-br-lg" style={{ borderColor: '#2563eb', opacity: 0.2 }}></div>

            {/* Filigrane Logo — décoratif, masqué aux lecteurs d'écran */}
            <div aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.035] w-[600px] h-[600px] flex items-center justify-center">
                <img 
                    src="/logo-fsa.png" 
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-contain grayscale"
                />
            </div>

            {/* ✅ ANTI-FORGERY: Security watermark */}
            <AttestationWatermark
              attestationId={data.id}
              userId={data.id} // Will be replaced with actual userId
              code={data.code}
              generatedAt={data.issuedAt && !isNaN(new Date(data.issuedAt).getTime()) 
                ? new Date(data.issuedAt).toISOString() 
                : new Date().toISOString()}
              invisible={false}
            />

            {/* 🛡️ SECURITY OVERLAY: REJECTED WATERMARK */}
            {data.status === "REJECTED" && (
                <div aria-hidden="true" className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}>
                    <div className="rotate-[-25deg] border-[8px] @lg:border-[12px] px-4 @lg:px-12 py-4 @lg:py-6 rounded-3xl flex flex-col items-center gap-2 @lg:scale-150" style={{ borderColor: 'rgba(225, 29, 72, 0.3)' }}>
                        <span className="text-4xl @lg:text-6xl @3xl:text-7xl font-black uppercase tracking-[0.15em] @lg:tracking-[0.2em]" style={{ color: 'rgba(225, 29, 72, 0.5)' }}>RÉVOQUÉ</span>
                        <span className="text-[13px] @lg:text-xl @3xl:text-2xl font-bold uppercase tracking-[0.2em] @lg:tracking-[0.5em]" style={{ color: 'rgba(225, 29, 72, 0.4)' }}>DOCUMENT INVALIDÉ</span>
                    </div>
                </div>
            )}

            {/* Le padding vit sur ce bloc (et non sur la racine ci-dessus) pour
                que la largeur de référence des container queries soit bien celle
                du document : 1120 px figés en impression, la largeur réelle sur
                mobile. Le rendu A4 est donc identique à l'existant. */}
            <div className="relative z-10 flex flex-col items-center w-full p-5 @lg:p-8 @3xl:p-14 space-y-6 @lg:space-y-8 @3xl:space-y-10" style={{ opacity: data.status === "REJECTED" ? 0.6 : 1 }}>
                    <div className="space-y-2 text-center">
                        <p className="text-[10px] uppercase tracking-[0.3em] @lg:tracking-[0.4em] font-black" style={{ color: "#2563eb" }}>Document Officiel</p>
                        <h2 className="text-2xl @lg:text-3xl @3xl:text-4xl font-black tracking-tight leading-tight @lg:leading-none break-words" style={{ color: INK_SOFT }}>
                            {data.type === "STAGE" ? "Certificat de Stage" : "Attestation de Fin de Formation"}
                        </h2>
                    </div>

                    <div aria-hidden="true" className="w-16 h-1 mx-auto rounded-full" style={{ background: "linear-gradient(to right, #2563eb, #10b981)" }}></div>

                    <div className="py-1 text-center w-full">
                        <p className="text-xs @lg:text-[11px] mb-2 @lg:mb-3 font-medium" style={{ color: MUTED }}>Ce document certifie officiellement le parcours de</p>
                        <p className={cn(
                            "font-black tracking-tighter capitalize leading-[1.15] @lg:leading-[1.1] break-words hyphens-none",
                            nameSize
                        )} style={{ color: INK }}>
                            {data.fullName}
                        </p>
                    </div>

                <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3 @lg:gap-5 w-full">
                    <div className="p-4 @lg:p-5 rounded-3xl border flex flex-col justify-center min-w-0" style={{ backgroundColor: "#f8fafc", borderColor: '#e2e8f0' }}>
                        <p className="text-[10px] @3xl:text-[9px] uppercase font-black mb-1 tracking-widest" style={{ color: MUTED }}>Formation / Projet</p>
                        <p className="font-bold text-sm @lg:text-base leading-tight @3xl:text-lg break-words" style={{ color: INK }}>
                            {data.formationName}
                        </p>
                    </div>

                    <div className="p-4 @lg:p-5 rounded-3xl border flex flex-col justify-center min-w-0" style={{ backgroundColor: "#f8fafc", borderColor: '#e2e8f0' }}>
                        <p className="text-[10px] @3xl:text-[9px] uppercase font-black mb-1 tracking-widest" style={{ color: MUTED }}>Période d&apos;évaluation</p>
                        <p className="font-bold text-sm @lg:text-base @3xl:text-lg break-words" style={{ color: INK }}>
                            {formatDate(data.startDate)} — {formatDate(data.endDate)}
                        </p>
                    </div>

                    {/* Évaluations */}
                    <div className="p-4 @lg:p-5 rounded-3xl border flex flex-col justify-center text-left" style={{ backgroundColor: "#f8fafc", borderColor: '#e2e8f0' }}>
                        <div className="space-y-3 @lg:space-y-4">
                            <div>
                                <p className="text-[10px] @3xl:text-[9px] uppercase font-black mb-1 tracking-widest" style={{ color: MUTED }}>Évaluation Théorique (Examen)</p>
                                <p className="font-black text-xl @lg:text-2xl @3xl:text-3xl" style={{ color: "#2563eb" }}>
                                    {data.score || 0} / 100
                                </p>
                            </div>
                            
                            {(data as any).stageScore > 0 && (
                                <div>
                                    <p className="text-[10px] @3xl:text-[9px] uppercase font-black mb-1 tracking-widest" style={{ color: MUTED }}>Évaluation Pratique (Stage)</p>
                                    <p className="font-black text-xl @lg:text-2xl @3xl:text-3xl" style={{ color: "#047857" }}>
                                        {(data as any).stageScore} / 100
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 @lg:p-5 rounded-3xl border flex flex-col justify-center text-left" style={{ backgroundColor: "#f8fafc", borderColor: '#e2e8f0' }}>
                        <p className="text-[10px] @3xl:text-[9px] uppercase font-black mb-1 tracking-widest" style={{ color: MUTED }}>Décision Finale du Jury</p>
                        <div className="flex flex-col gap-2">
                             <div className="flex items-center gap-2 @lg:gap-3">
                                <span className="font-black text-lg @lg:text-2xl @3xl:text-3xl uppercase" style={{ color: currentStatus.color }}>
                                    {currentStatus.label}
                                </span>
                                {data.status === "VALIDATED" && <BadgeCheck aria-hidden="true" className="w-5 h-5 @lg:w-6 @lg:h-6 @3xl:w-7 @3xl:h-7" style={{ color: "#059669" }} />}
                             </div>
                             {(data as any).stageScore > 0 && (
                                <span className="text-[10px] @3xl:text-[9px] font-bold px-2 py-0.5 rounded-full w-fit" style={{ color: '#047857', backgroundColor: '#ecfdf5' }}>
                                    ✓ PARCOURS COMPLET TERMINÉ
                                </span>
                             )}
                        </div>
                    </div>
                </div>

                {/* Footer de la fiche */}
                <div className="mt-6 @lg:mt-8 @3xl:mt-10 pt-4 @lg:pt-5 @3xl:pt-6 w-full flex flex-col @lg:flex-row items-center justify-between gap-2 @lg:gap-3 text-[10px] @3xl:text-[9px] font-mono border-t text-center @lg:text-left" style={{ color: MUTED, borderTopColor: '#e2e8f0' }}>
                    <div className="flex flex-wrap justify-center @lg:justify-start gap-x-4 gap-y-1 min-w-0">
                        <span className="font-medium">ID: {data.id?.slice(0, 8) || "--------"}...</span>
                        <span className="font-bold break-all" style={{ color: INK_SOFT }}>CODE: {data.code}</span>
                    </div>
                    <span className="font-black tracking-[0.15em] @lg:tracking-[0.2em] uppercase" style={{ color: INK_SOFT }}>© FERME SAINT ANDRÉ • PORTAL</span>
                </div>
            </div>
        </div>
    </div>
  );
}
