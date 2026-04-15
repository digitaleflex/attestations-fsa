"use client";

import React, { useEffect, useState } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptDocumentProps {
  data: {
    id: string;
    fullName: string;
    formationName: string;
    sessionName: string;
    scorePart1: number;
    scorePart2: number;
    scorePart3: number;
    maxPart1?: number;
    maxPart2?: number;
    maxPart3?: number;
    totalScore: number;
    status: string;
    issuedAt: string | Date;
  };
  id?: string;
  isPrinting?: boolean;
}

export default function TranscriptDocument({ data, id = "transcript-document-content", isPrinting = false }: TranscriptDocumentProps): React.JSX.Element {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatDate = (d: string | Date | undefined): string => {
    if (!mounted || !d) return "--/--/----";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const getMention = (score: number) => {
    if (score >= 90) return "EXCELLENT";
    if (score >= 80) return "TRES BIEN";
    if (score >= 70) return "BIEN";
    if (score >= 60) return "ASSEZ BIEN";
    if (score >= 50) return "PASSABLE";
    return "INSUFFISANT";
  };

  // Barèmes dynamiques avec fallbacks
  const mP1 = data.maxPart1 || 20;
  const mP2 = data.maxPart2 || 40;
  const mP3 = data.maxPart3 || 40;
  const mTotal = mP1 + mP2 + mP3;

  return (
    <div className={cn(
        "flex flex-col items-center relative overflow-hidden transition-all duration-300",
        isPrinting 
          ? "w-[1120px] min-w-[1120px] h-[790px] max-h-[790px] p-20 overflow-hidden rounded-none" 
          : "w-full p-8 md:p-12 rounded-[32px] shadow-xl shadow-slate-100 border border-slate-100"
    )} style={{ backgroundColor: '#ffffff' }} id={id}>
        {/* Decorative Borders for Printing */}
        {isPrinting && (
            <>
                <div className="absolute inset-4 border border-slate-100 pointer-events-none rounded-[24px]" />
                <div className="absolute inset-6 border-2 border-slate-800/5 pointer-events-none rounded-[20px]" />
            </>
        )}
        {/* Filigrane Logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] w-[500px] h-[500px] flex items-center justify-center">
            <img 
                src="/logo-fsa.png" 
                alt="Watermark" 
                className="w-full h-full object-contain grayscale"
            />
        </div>

        <div className={cn("relative z-10 w-full", isPrinting ? "space-y-10" : "space-y-10")}>
            {/* Header / Banner */}
            <div className={cn("flex flex-col md:flex-row items-center justify-between gap-6", isPrinting ? "pb-4" : "pb-8")} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#2563eb' }}>
                        <ShieldCheck className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-left">
                        <h1 className="text-xl font-black tracking-tight uppercase" style={{ color: '#0f172a' }}>Ferme Saint André</h1>
                        <p className="text-[9px] font-bold tracking-[0.3em] uppercase" style={{ color: '#2563eb' }}>Portail de Certification Académique</p>
                    </div>
                </div>
                <div className="text-center md:text-right">
                    <div className="inline-block px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase mb-1" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                        Relevé de Notes Officiel
                    </div>
                    <p className="text-xs font-mono font-bold" style={{ color: '#94a3b8' }}>Réf: {data.id.slice(0, 12).toUpperCase()}</p>
                </div>
            </div>

            {/* Candidate Identity */}
            <div className={cn("rounded-3xl border px-8 flex flex-col md:flex-row justify-between items-center gap-6", isPrinting ? "py-4" : "py-6")} style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>Candidat Certifié</p>
                    <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: '#0f172a' }}>{data.fullName}</h2>
                </div>
                <div className="md:text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>Session d&apos;Examen</p>
                    <p className="text-lg font-bold" style={{ color: '#1e293b' }}>{data.sessionName}</p>
                </div>
            </div>

            {/* Grades Table */}
            <div className="w-full">
                <div className="grid grid-cols-12 p-3 rounded-t-2xl text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    <div className="col-span-6 uppercase">Modules / Épreuves</div>
                    <div className="col-span-3 text-center">Score obtenu</div>
                    <div className="col-span-3 text-center">Barème</div>
                </div>
                <div className="border border-t-0 rounded-b-2xl overflow-hidden divide-y text-xs" style={{ borderColor: '#f1f5f9' }}>
                    <div className={cn("grid grid-cols-12 items-center hover:bg-slate-50/50 transition-colors", isPrinting ? "p-4" : "p-5")}>
                        <div className="col-span-6">
                            <p className="font-bold" style={{ color: '#1e293b' }}>Partie I : Connaissances Théoriques</p>
                            <p className="text-[10px] italic" style={{ color: '#94a3b8' }}>Questions à choix multiples et théorie pure</p>
                        </div>
                        <div className="col-span-3 text-center text-lg font-black" style={{ color: '#0f172a' }}>{data.scorePart1.toFixed(2)}</div>
                        <div className="col-span-3 text-center font-bold" style={{ color: '#94a3b8' }}>{mP1.toFixed(2)}</div>
                    </div>
                    <div className={cn("grid grid-cols-12 items-center hover:bg-slate-50/50 transition-colors", isPrinting ? "p-4" : "p-5")}>
                        <div className="col-span-6">
                            <p className="font-bold" style={{ color: '#1e293b' }}>Partie II : Études de Cas & Logique</p>
                            <p className="text-[10px] italic" style={{ color: '#94a3b8' }}>Situations professionnelles et résolution de problèmes</p>
                        </div>
                        <div className="col-span-3 text-center text-lg font-black" style={{ color: '#0f172a' }}>{data.scorePart2.toFixed(2)}</div>
                        <div className="col-span-3 text-center font-bold" style={{ color: '#94a3b8' }}>{mP2.toFixed(2)}</div>
                    </div>
                    <div className={cn("grid grid-cols-12 items-center hover:bg-slate-50/50 transition-colors", isPrinting ? "p-4" : "p-5")}>
                        <div className="col-span-6">
                            <p className="font-bold" style={{ color: '#1e293b' }}>Partie III : Épreuve Pratique / Rédaction</p>
                            <p className="text-[10px] italic" style={{ color: '#94a3b8' }}>Application directe des compétences sur le terrain</p>
                        </div>
                        <div className="col-span-3 text-center text-lg font-black" style={{ color: '#0f172a' }}>{data.scorePart3.toFixed(2)}</div>
                        <div className="col-span-3 text-center font-bold" style={{ color: '#94a3b8' }}>{mP3.toFixed(2)}</div>
                    </div>

                    {/* Summary Row */}
                    <div className={cn("grid grid-cols-12 items-center", isPrinting ? "p-4" : "p-6")} style={{ backgroundColor: 'rgba(37, 99, 235, 0.05)' }}>
                        <div className="col-span-6">
                            <p className="font-black text-sm uppercase" style={{ color: '#1e3a8a' }}>Moyenne Générale Pondérée</p>
                            <p className="text-[10px] font-bold uppercase mt-1" style={{ color: '#2563eb' }}>RÉSULTAT : {getMention(Math.round((data.totalScore / mTotal) * 100))}</p>
                        </div>
                        <div className="col-span-3 text-center">
                            <div className="inline-block px-6 py-2 rounded-2xl text-white font-black text-2xl shadow-lg" style={{ backgroundColor: '#2563eb' }}>
                                {data.totalScore.toFixed(2)}
                            </div>
                        </div>
                        <div className="col-span-3 text-center font-black text-sm" style={{ color: 'rgba(30, 58, 138, 0.4)' }}>/ {mTotal.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {/* Signature & Validation Footer */}
            <div className={cn("flex flex-col md:flex-row justify-between items-end border-t gap-12", isPrinting ? "pt-6" : "pt-12")} style={{ borderTopColor: '#f8fafc' }}>
                <div className="text-left space-y-4">
                    <div className="flex items-center gap-3" style={{ color: '#059669' }}>
                        <BadgeCheck className="w-6 h-6" />
                        <span className="font-black text-sm uppercase tracking-tight">Authentifié par la Direction Technique</span>
                    </div>
                    <div className="p-4 rounded-2xl border text-[10px] font-bold max-w-xs leading-relaxed italic" style={{ backgroundColor: 'rgba(5, 150, 105, 0.05)', borderColor: '#a7f3d0', color: '#047857' }}>
                        &quot;Nous certifions que l&apos;étudiant a validé avec succès l&apos;ensemble des modules d&apos;évaluation correspondant à la formation {data.formationName}.&quot;
                    </div>
                </div>

                <div className="text-right space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>Fait à Abomey-Calavi, le</p>
                    <p className="text-lg font-black" style={{ color: '#0f172a' }}>{formatDate(data.issuedAt)}</p>
                    <div className="h-16 w-48 border-b-2 flex items-center justify-center font-black text-sm italic" style={{ borderBottomColor: '#f1f5f9', color: '#e2e8f0' }}>
                        Signature & Cachet
                    </div>
                </div>
            </div>

            {/* Micro footer */}
            <div className="pt-4 text-center border-t" style={{ borderTopColor: '#f8fafc' }}>
                <p className="text-[8px] font-bold uppercase tracking-[1em]" style={{ color: '#cbd5e1' }}>Ferme Saint André • Excellence • Rigueur • Passion</p>
            </div>
        </div>
    </div>
  );
}
