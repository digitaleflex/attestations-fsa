"use client";

import React from "react";
import { Award, CheckCircle, ShieldCheck, Clock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface CertificateTemplateProps {
  data: {
    fullName: string;
    formationName: string;
    code: string;
    issuedAt: string | Date;
    startDate?: string | Date;
    endDate?: string | Date;
    score?: number;
    hours?: number;
    type: string;
    gender?: string;
  };
  settings?: {
    institutionName: string;
    institutionLogo: string | null;
    instructorName: string;
    instructorTitle: string;
    signatureUrl: string | null;
    location: string;
  };
  id?: string;
}

const CertificateTemplate = ({ data, settings, id = "certificate-content" }: CertificateTemplateProps) => {
  const formatDate = (d: string | Date | undefined) => {
    if (!d) return "--/--/----";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const prefix = data.gender === "F" ? "Mme " : data.gender === "M" ? "M. " : "";

  const issuedDate = formatDate(data.issuedAt);
  const startDate = formatDate(data.startDate);
  const endDate = formatDate(data.endDate);

  const verificationUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/verifier?code=${data.code}` 
    : "";

  return (
    <div 
      className="bg-white" 
      style={{ width: "1122px", height: "794px", fontFamily: "'Times New Roman', Times, serif" }} 
      id={id}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Charmonman:wght@700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap');
      `}} />
      <div className="w-full h-full p-12 relative flex flex-col items-center border-[1px] border-slate-200">
        
        {/* Bordures Florales Rouges (Coins) */}
        <div className="absolute top-4 left-4 w-40 h-40 opacity-90">
           <svg viewBox="0 0 100 100" className="fill-red-600 rotate-0">
             <path d="M10,10 Q30,10 40,40 Q10,30 10,10 Z M20,20 Q60,20 70,70 Q20,60 20,20 Z" opacity="0.3"/>
             <path d="M5,5 C30,5 50,25 50,50 C25,50 5,30 5,5 M15,5 C40,5 60,25 60,50 C35,50 15,30 15,5" fill="none" stroke="currentColor" strokeWidth="1"/>
           </svg>
        </div>
        <div className="absolute top-4 right-4 w-40 h-40 opacity-90 rotate-90">
           <svg viewBox="0 0 100 100" className="fill-red-600">
             <path d="M10,10 Q30,10 40,40 Q10,30 10,10 Z" opacity="0.3"/>
           </svg>
        </div>
        <div className="absolute bottom-4 left-4 w-40 h-40 opacity-90 -rotate-90">
           <svg viewBox="0 0 100 100" className="fill-red-600">
             <path d="M10,10 Q30,10 40,40 Q10,30 10,10 Z" opacity="0.3"/>
           </svg>
        </div>
        <div className="absolute bottom-4 right-4 w-40 h-40 opacity-90 rotate-180">
           <svg viewBox="0 0 100 100" className="fill-red-600">
             <path d="M10,10 Q30,10 40,40 Q10,30 10,10 Z" opacity="0.3"/>
           </svg>
        </div>

        {/* Cadre Ligne Double Fine */}
        <div className="absolute inset-8 border-[1px] border-red-800 pointer-events-none"></div>
        <div className="absolute inset-10 border-[0.5px] border-red-400 pointer-events-none"></div>

        {/* Double Logos Circulaires */}
        <div className="z-10 w-full flex justify-between px-16 mt-4">
          <div className="w-32 h-32 rounded-full border-2 border-red-700 p-1 flex flex-col items-center justify-center text-center bg-white shadow-sm overflow-hidden">
            {settings?.institutionLogo ? (
                <img src={settings.institutionLogo} alt="Logo" className="w-full h-full object-contain" />
            ) : (
                <>
                    <div className="text-[10px] uppercase font-black text-red-800 leading-tight px-1">{settings?.institutionName || "Ferme Agro Piscicole"}</div>
                    <div className="w-10 h-6 border-y border-red-300 my-1 flex items-center justify-center">🐟</div>
                    <div className="text-[8px] font-bold text-red-600 uppercase tracking-widest">St Andre</div>
                </>
            )}
          </div>

          <div className="text-center pt-4">
            <h1 className="text-6xl font-serif font-bold text-red-600 tracking-widest uppercase mb-1">
              {data.type === "FORMATION" ? "ATTESTATION" : data.type === "STAGE" ? "CERTIFICAT" : "DIPLÔME"}
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-[2px] bg-amber-600"></div>
              <p className="text-2xl text-red-700 uppercase tracking-[0.3em] font-medium">
                {data.type === "FORMATION" ? "DE FORMATION" : data.type === "STAGE" ? "DE STAGE" : "DE RÉUSSITE"}
              </p>
              <div className="w-12 h-[2px] bg-amber-600"></div>
            </div>
          </div>

          <div className="w-32 h-32 rounded-full border-2 border-red-700 p-1 flex flex-col items-center justify-center text-center bg-white shadow-sm overflow-hidden">
            {settings?.institutionLogo ? (
                <img src={settings.institutionLogo} alt="Logo" className="w-full h-full object-contain" />
            ) : (
                <>
                    <div className="text-[10px] uppercase font-black text-red-800 leading-tight px-1">{settings?.institutionName || "Ferme Agro Piscicole"}</div>
                    <div className="w-10 h-6 border-y border-red-300 my-1 flex items-center justify-center">🐟</div>
                    <div className="text-[8px] font-bold text-red-600 uppercase tracking-widest">St Andre</div>
                </>
            )}
          </div>
        </div>

        {/* Corps du texte */}
        <div className="z-10 text-center mt-12 space-y-6 px-24">
          <p className="text-2xl text-slate-800">
            {settings?.institutionName || "La Ferme Agro-piscicole St Andre"} certifie que {prefix}
          </p>
          
          <h2 className="text-6xl italic text-slate-900 py-4 font-extrabold capitalize" style={{ fontFamily: "'Charmonman', cursive, serif" }}>
            {data.fullName}
          </h2>
          
          <p className="text-2xl text-slate-800 leading-relaxed font-medium">
            a suivi avec succès une <span className="font-black underline decoration-red-600">Formation en {data.formationName}</span>
          </p>
          
          <p className="text-2xl text-slate-800">
             du <span className="font-bold underline">{startDate}</span> au <span className="font-bold underline">{endDate}</span>
          </p>
          
          <p className="text-xl text-slate-700 italic pt-8">
            Cette attestation est délivrée pour servir et faire valoir ce que de droit.
          </p>
        </div>

        {/* Footer */}
        <div className="z-10 w-full mt-auto mb-10 px-24 flex flex-col items-end">
          <p className="text-lg text-slate-800">
            Fait à {settings?.location || "Abomey-Calavi"}, le {issuedDate}
          </p>
          
          <div className="mt-8 text-center w-64 mr-4">
            <div className="w-full h-[1px] bg-slate-400 mb-2"></div>
            <p className="text-xl font-bold text-red-700 uppercase">{settings?.instructorTitle || "Le Responsable"}</p>
            <div className="h-16 flex items-center justify-center text-red-800 text-4xl" style={{ fontFamily: "'Dancing Script', cursive" }}>
              {settings?.signatureUrl ? (
                <img src={settings.signatureUrl} alt="Signature" className="max-h-full" />
              ) : (
                settings?.instructorName || "Augustin Boko"
              )}
            </div>
            {settings?.signatureUrl && <p className="text-sm font-bold text-slate-700 mt-2">{settings.instructorName}</p>}
          </div>
        </div>

        {/* Code et QR Code Discret en bas */}
        <div className="absolute bottom-4 w-full flex justify-center items-center gap-10">
           <p className="text-xs font-mono text-slate-500 tracking-widest uppercase">
             code de l'attestation : {data.code}
           </p>
           <div className="p-1 bg-white border border-slate-100 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
              <QRCodeSVG value={verificationUrl} size={35} />
           </div>
        </div>

      </div>
    </div>
  );
};

export default CertificateTemplate;
