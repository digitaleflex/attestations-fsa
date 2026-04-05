"use client";

import React, { useEffect, useState } from "react";
import { ClipboardList, BadgeCheck, ShieldCheck } from "lucide-react";
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
    totalScore: number;
    status: string;
    issuedAt: string | Date;
  };
  id?: string;
  isPrinting?: boolean;
}

export default function TranscriptDocument({ data, id = "transcript-document-content", isPrinting = false }: TranscriptDocumentProps) {
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

  const getMention = (score: number) => {
    if (score >= 90) return "EXCELLENT";
    if (score >= 80) return "TRES BIEN";
    if (score >= 70) return "BIEN";
    if (score >= 60) return "ASSEZ BIEN";
    if (score >= 50) return "PASSABLE";
    return "INSUFFISANT";
  };

  return (
    <div className={cn(
        "flex flex-col items-center p-8 md:p-12 rounded-[32px] relative bg-white overflow-hidden transition-all duration-300",
        isPrinting ? "w-[1120px] min-w-[1120px]" : "w-full shadow-xl shadow-slate-100 border border-slate-100"
    )} id={id}>
        {/* Filigrane */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none rotate-12">
            <ClipboardList size={500} />
        </div>

        <div className="relative z-10 w-full space-y-10">
            {/* Header / Banner */}
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-100 pb-8 gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-left">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Ferme Saint André</h1>
                        <p className="text-[10px] font-bold text-blue-600 tracking-[0.3em] uppercase">Portail de Certification Académique</p>
                    </div>
                </div>
                <div className="text-center md:text-right">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black tracking-widest uppercase mb-2">
                        Relevé de Notes Officiel
                    </div>
                    <p className="text-xs font-mono text-slate-400 font-bold">Réf: {data.id.slice(0, 12).toUpperCase()}</p>
                </div>
            </div>

            {/* Candidate Identity */}
            <div className="py-6 rounded-3xl bg-slate-50 border border-slate-100 px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Candidat Certifié</p>
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{data.fullName}</h2>
                </div>
                <div className="md:text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Session d&apos;Examen</p>
                    <p className="text-xl font-bold text-slate-800">{data.sessionName}</p>
                </div>
            </div>

            {/* Grades Table */}
            <div className="w-full">
                <div className="grid grid-cols-12 bg-slate-900 text-white p-4 rounded-t-2xl text-[10px] font-black uppercase tracking-widest">
                    <div className="col-span-6 uppercase">Modules / Épreuves</div>
                    <div className="col-span-3 text-center">Score obtenu</div>
                    <div className="col-span-3 text-center">Barème</div>
                </div>
                <div className="border border-t-0 border-slate-100 rounded-b-2xl overflow-hidden divide-y divide-slate-50 text-xs">
                    <div className="grid grid-cols-12 p-5 items-center hover:bg-slate-50/50 transition-colors">
                        <div className="col-span-6">
                            <p className="font-bold text-slate-800">Partie I : Connaissances Théoriques</p>
                            <p className="text-[10px] text-slate-400 italic">Questions à choix multiples et théorie pure</p>
                        </div>
                        <div className="col-span-3 text-center text-lg font-black text-slate-900">{data.scorePart1.toFixed(2)}</div>
                        <div className="col-span-3 text-center text-slate-400 font-bold">20.00</div>
                    </div>
                    <div className="grid grid-cols-12 p-5 items-center hover:bg-slate-50/50 transition-colors">
                        <div className="col-span-6">
                            <p className="font-bold text-slate-800">Partie II : Études de Cas & Logique</p>
                            <p className="text-[10px] text-slate-400 italic">Situations professionnelles et résolution de problèmes</p>
                        </div>
                        <div className="col-span-3 text-center text-lg font-black text-slate-900">{data.scorePart2.toFixed(2)}</div>
                        <div className="col-span-3 text-center text-slate-400 font-bold">40.00</div>
                    </div>
                    <div className="grid grid-cols-12 p-5 items-center hover:bg-slate-50/50 transition-colors">
                        <div className="col-span-6">
                            <p className="font-bold text-slate-800">Partie III : Épreuve Pratique / Rédaction</p>
                            <p className="text-[10px] text-slate-400 italic">Application directe des compétences sur le terrain</p>
                        </div>
                        <div className="col-span-3 text-center text-lg font-black text-slate-900">{data.scorePart3.toFixed(2)}</div>
                        <div className="col-span-3 text-center text-slate-400 font-bold">40.00</div>
                    </div>

                    {/* Summary Row */}
                    <div className="grid grid-cols-12 p-6 bg-blue-50/30 items-center">
                        <div className="col-span-6">
                            <p className="font-black text-blue-900 text-sm uppercase">Moyenne Générale Pondérée</p>
                            <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Mention obtenue : {getMention(data.totalScore)}</p>
                        </div>
                        <div className="col-span-3 text-center">
                            <div className="inline-block px-6 py-2 rounded-2xl bg-blue-600 text-white font-black text-2xl shadow-lg shadow-blue-100">
                                {data.totalScore.toFixed(2)}
                            </div>
                        </div>
                        <div className="col-span-3 text-center text-blue-900/40 font-black text-sm">/ 100.00</div>
                    </div>
                </div>
            </div>

            {/* Signature & Validation Footer */}
            <div className="flex flex-col md:flex-row justify-between items-end pt-12 border-t border-slate-50 gap-12">
                <div className="text-left space-y-4">
                    <div className="flex items-center gap-3 text-emerald-600">
                        <BadgeCheck className="w-6 h-6" />
                        <span className="font-black text-sm uppercase tracking-tight">Authentifié par la Direction Technique</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-[10px] text-emerald-700 font-bold max-w-xs leading-relaxed italic">
                        &quot;Nous certifions que l&apos;étudiant a validé avec succès l&apos;ensemble des modules d&apos;évaluation correspondant à la formation {data.formationName}.&quot;
                    </div>
                </div>

                <div className="text-right space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fait à Abomey-Calavi, le</p>
                    <p className="text-lg font-black text-slate-900">{formatDate(data.issuedAt)}</p>
                    <div className="h-20 w-48 border-b-2 border-slate-100 flex items-center justify-center text-slate-200 font-black text-sm italic">
                        Signature & Cachet
                    </div>
                </div>
            </div>

            {/* Micro footer */}
            <div className="pt-8 text-center border-t border-slate-50">
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[1em]">Ferme Saint André • Excellence • Rigueur • Passion</p>
            </div>
        </div>
    </div>
  );
}
