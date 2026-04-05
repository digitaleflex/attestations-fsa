"use client";

import React, { useEffect, useState } from "react";
import { Award, CheckCircle, XCircle, Clock, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttestationWatermark } from "@/components/AttestationWatermark";

interface OfficialDocumentProps {
  data: {
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
  };
  id?: string;
  hideStepper?: boolean;
  isPrinting?: boolean;
}

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
    REJECTED: { label: "REFUSÉ", color: "#dc2626", bg: "#fef2f2", icon: XCircle },
    PENDING: { label: "EN ATTENTE", color: "#d97706", bg: "#fffbeb", icon: Clock },
  };

  const currentStatus = statusConfig[data.status as keyof typeof statusConfig] || statusConfig.PENDING;

  return (
    <div className="w-full flex flex-col items-center">
        {!hideStepper && (
            <div className="w-full max-w-sm mb-12 flex items-center justify-between relative no-pdf">
                <div className="absolute top-4 left-0 w-full h-[1px] -z-0 bg-slate-100" />
                
                {/* Étape 1: Création */}
                <div className="flex flex-col items-center gap-2 z-10">
                    <div className="w-8 h-8 rounded-full text-white flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-sm bg-blue-600">1</div>
                    <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">Création</span>
                </div>

                {/* Étape 2: Examen Jury */}
                <div className="flex flex-col items-center gap-2 z-10">
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-sm transition-all duration-500",
                        data.status === "PENDING" ? "animate-pulse" : ""
                    )} style={{ 
                        backgroundColor: data.status === "PENDING" ? "#f59e0b" : 
                                        (data.status === "VALIDATED" || data.status === "REJECTED") ? "#10b981" : "#f1f5f9",
                        color: (data.status === "PENDING" || data.status === "VALIDATED" || data.status === "REJECTED") ? "#ffffff" : "#94a3b8"
                    }}>
                        { (data.status === "VALIDATED" || data.status === "REJECTED") ? "✓" : "2" }
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">Examen</span>
                </div>

                {/* Étape 3: Décision */}
                <div className="flex flex-col items-center gap-2 z-10">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-sm transition-all duration-500" style={{ 
                        backgroundColor: data.status === "VALIDATED" ? "#059669" : 
                                        data.status === "REJECTED" ? "#dc2626" : "#f1f5f9",
                        color: (data.status === "VALIDATED" || data.status === "REJECTED") ? "#ffffff" : "#94a3b8"
                    }}>
                        { data.status === "VALIDATED" ? "✓" : data.status === "REJECTED" ? "✕" : "3" }
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">Décision</span>
                </div>
            </div>
        )}

        {/* Le Document Officiel (Minimaliste) */}
        <div 
          id={id} 
          className={cn(
            "flex flex-col items-center p-8 md:p-12 rounded-[24px] relative bg-white overflow-hidden transition-all duration-300",
            isPrinting ? "w-[1120px] min-w-[1120px]" : "w-full shadow-sm"
          )} 
          style={{ border: "1px solid #f1f5f9" }}
        >
            {/* Filigrane discret */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none" style={{ color: "#000000" }}>
                <Award size={400} />
            </div>

            {/* ✅ ANTI-FORGERY: Security watermark */}
            <AttestationWatermark
              attestationId={data.id}
              userId={data.id} // Will be replaced with actual userId
              code={data.code}
              generatedAt={new Date(data.issuedAt).toISOString()}
              invisible={false}
            />

            <div className="relative z-10 flex flex-col items-center w-full space-y-12">
                <div className="space-y-3 text-center">
                    <p className="text-xs uppercase tracking-[0.4em] font-black" style={{ color: "#2563eb" }}>Document Officiel</p>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-none" style={{ color: "#1e293b" }}>
                        {data.type === "FORMATION" ? "Attestation de Formation" : 
                         data.type === "STAGE" ? "Certificat de Stage" : "Diplôme de Réussite"}
                    </h2>
                </div>

                <div className="w-24 h-1.5 mx-auto rounded-full" style={{ background: "linear-gradient(to right, #2563eb, #10b981)" }}></div>

                <div className="py-2 text-center">
                    <p className="text-sm mb-4 font-medium" style={{ color: "#64748b" }}>Ce document certifie officiellement le parcours de</p>
                    <p className="text-4xl md:text-6xl font-black tracking-tighter capitalize" style={{ color: "#0f172a" }}>
                        {data.fullName}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    <div className="p-6 rounded-3xl border border-slate-100 flex flex-col justify-center" style={{ backgroundColor: "#f8fafc" }}>
                        <p className="text-[10px] uppercase font-black mb-1.5 tracking-widest" style={{ color: "#64748b" }}>Formation / Projet</p>
                        <p className="font-bold text-lg leading-tight" style={{ color: "#0f172a" }}>
                            {data.formationName}
                        </p>
                    </div>
                    
                    <div className="p-6 rounded-3xl border border-slate-100 flex flex-col justify-center" style={{ backgroundColor: "#f8fafc" }}>
                        <p className="text-[10px] uppercase font-black mb-1.5 tracking-widest" style={{ color: "#64748b" }}>Période d&apos;évaluation</p>
                        <p className="font-bold text-lg" style={{ color: "#0f172a" }}>
                            {formatDate(data.startDate)} — {formatDate(data.endDate)}
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-slate-100 flex flex-col justify-center text-left" style={{ backgroundColor: "#f8fafc" }}>
                        <p className="text-[10px] uppercase font-black mb-1.5 tracking-widest" style={{ color: "#64748b" }}>Évaluation finale</p>
                        <p className="font-black text-3xl" style={{ color: "#059669" }}>
                            {data.score} / 100
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-slate-100 flex flex-col justify-center text-left" style={{ backgroundColor: "#f8fafc" }}>
                        <p className="text-[10px] uppercase font-black mb-1.5 tracking-widest" style={{ color: "#64748b" }}>Décision du jury</p>
                        <div className="flex items-center gap-3">
                            <span className="font-black text-3xl" style={{ color: currentStatus.color }}>
                                {currentStatus.label}
                            </span>
                            {data.status === "VALIDATED" && <BadgeCheck className="w-7 h-7" style={{ color: "#059669" }} />}
                        </div>
                    </div>
                </div>

                {/* Footer de la fiche */}
                <div className="mt-12 pt-8 w-full flex flex-col md:flex-row items-center justify-between text-[10px] font-mono border-t border-slate-100 gap-4" style={{ color: "#64748b" }}>
                    <div className="flex gap-4">
                        <span className="font-medium">ID: {data.id.slice(0, 8)}...</span>
                        <span className="font-bold" style={{ color: "#334155" }}>CODE: {data.code}</span>
                    </div>
                    <span className="font-black tracking-[0.2em] uppercase" style={{ color: "#1e293b" }}>© FERME SAINT ANDRÉ • PORTAL</span>
                </div>
            </div>
        </div>
    </div>
  );
}
