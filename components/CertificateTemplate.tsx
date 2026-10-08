/* trunk-ignore-all(prettier) */
"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { resolveMention } from "@/lib/exams/scoring";

/* Palette du certificat — tokens de marque (#62, épic #42).
   Le rouge historique du cadre calligraphié s'aligne sur `brand` /
   `brand-dark`, les filets fins sur `brand-light`, les filets dorés sur
   `brand-accent` ; les textes suivent `brand-ink` / `brand-muted` et les
   bordures neutres `brand-line`. Aucune donnée affichée ne change. */
const BRAND = "var(--color-brand)";
const BRAND_DARK = "var(--color-brand-dark)";
const BRAND_LIGHT = "var(--color-brand-light)";
const BRAND_ACCENT = "var(--color-brand-accent)";
const INK = "var(--color-brand-ink)";
const MUTED = "var(--color-brand-muted)";
const LINE = "var(--color-brand-line)";

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
    status: string;
    certificationMention?: string;
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

const CertificateTemplate = ({
  data,
  settings,
  id = "certificate-content",
}: CertificateTemplateProps) => {
  const formatDate = (d: string | Date | undefined) => {
    if (!d) return "--/--/----";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const prefix =
    data.gender === "F" ? "Mme " : data.gender === "M" ? "M. " : "";

  const MENTION_FR: Record<string, string> = {
    EXCELLENCE: "Mention Excellence",
    TRES_BIEN: "Mention Très Bien",
    BIEN: "Mention Bien",
    ASSEZ_BIEN: "Mention Assez Bien",
    PASSABLE: "Mention Passable",
  };
  // Source unique : mention stockée si disponible, sinon dérivée du score /100 (jamais /20).
  const mentionLabel = data.certificationMention
    ? MENTION_FR[data.certificationMention] ?? null
    : data.score !== undefined
      ? MENTION_FR[resolveMention(data.score)]
      : null;

  const issuedDate = formatDate(data.issuedAt);
  const startDate = formatDate(data.startDate);
  const endDate = formatDate(data.endDate);

  const verificationUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/verifier?code=${data.code}`
    : typeof window !== "undefined"
      ? `${window.location.origin}/verifier?code=${data.code}`
      : "";

  return (
    <div
      className="bg-white"
      style={{
        width: "1122px",
        height: "794px",
        fontFamily: "'Times New Roman', Times, serif",
        backgroundColor: "var(--color-brand-bg)",
      }}
      id={id}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Charmonman:wght@700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap');
      `,
        }}
      />
      <div
        className="w-full h-full p-12 relative flex flex-col items-center border-[1px]"
        style={{ borderColor: LINE }}
      >
        {/* 🛡️ SECURITY OVERLAY: REJECTED WATERMARK */}
        {data.status === "REJECTED" && (
            <div aria-hidden="true" className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}>
                <div className="rotate-[-25deg] border-[12px] px-12 py-6 rounded-3xl flex flex-col items-center gap-2 backdrop-blur-[2px] scale-150" style={{ borderColor: 'rgba(230, 0, 35, 0.3)' }}>
                    <span className="text-6xl md:text-8xl font-black uppercase tracking-[0.2em]" style={{ color: 'rgba(230, 0, 35, 0.5)' }}>RÉVOQUÉ</span>
                    <span className="text-xl md:text-2xl font-bold uppercase tracking-[0.5em]" style={{ color: 'rgba(230, 0, 35, 0.4)' }}>CERTIFICAT ANNULÉ - FSA</span>
                </div>
            </div>
        )}

        {/* Bordures Florales Rouges (Coins) */}
        <div aria-hidden="true" className="absolute top-4 left-4 w-40 h-40 opacity-90">
          <svg viewBox="0 0 100 100" style={{ fill: BRAND }}>
            <path
              d="M10,10 Q30,10 40,40 Q10,30 10,10 Z M20,20 Q60,20 70,70 Q20,60 20,20 Z"
              opacity="0.3"
            />
            <path
              d="M5,5 C30,5 50,25 50,50 C25,50 5,30 5,5 M15,5 C40,5 60,25 60,50 C35,50 15,30 15,5"
              fill="none"
              stroke={BRAND}
              strokeWidth="1"
            />
          </svg>
        </div>
        <div aria-hidden="true" className="absolute top-4 right-4 w-40 h-40 opacity-90 rotate-90">
          <svg viewBox="0 0 100 100" style={{ fill: BRAND }}>
            <path d="M10,10 Q30,10 40,40 Q10,30 10,10 Z" opacity="0.3" />
          </svg>
        </div>
        <div aria-hidden="true" className="absolute bottom-4 left-4 w-40 h-40 opacity-90 -rotate-90">
          <svg viewBox="0 0 100 100" style={{ fill: BRAND }}>
            <path d="M10,10 Q30,10 40,40 Q10,30 10,10 Z" opacity="0.3" />
          </svg>
        </div>
        <div aria-hidden="true" className="absolute bottom-4 right-4 w-40 h-40 opacity-90 rotate-180">
          <svg viewBox="0 0 100 100" style={{ fill: BRAND }}>
            <path d="M10,10 Q30,10 40,40 Q10,30 10,10 Z" opacity="0.3" />
          </svg>
        </div>

        {/* Cadre Ligne Double Fine */}
        <div
          aria-hidden="true"
          className="absolute inset-8 border-[1px] pointer-events-none"
          style={{ borderColor: BRAND_DARK }}
        ></div>
        <div
          aria-hidden="true"
          className="absolute inset-10 border-[0.5px] pointer-events-none"
          style={{ borderColor: BRAND_LIGHT }}
        ></div>

        {/* Double Logos Circulaires */}
        <div className="z-10 w-full flex justify-between px-16 mt-4">
          <div
            className="w-32 h-32 rounded-full border-2 p-1 flex flex-col items-center justify-center text-center bg-white shadow-sm overflow-hidden"
            style={{ borderColor: BRAND }}
          >
            {settings?.institutionLogo ? (
              <img
                src={settings.institutionLogo}
                alt="" aria-hidden="true"
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                <div
                  className="text-[10px] uppercase font-black leading-tight px-1"
                  style={{ color: BRAND_DARK }}
                >
                  {settings?.institutionName || "Ferme Agro-Piscicole St André"}
                </div>
                <div
                  className="w-10 h-6 border-y my-1 flex items-center justify-center"
                  style={{ borderColor: BRAND_LIGHT }}
                >
                  🐟
                </div>
                <div
                  className="text-[8px] font-bold uppercase tracking-widest"
                  style={{ color: BRAND }}
                >
                  St Andre
                </div>
              </>
            )}
          </div>

          <div className="text-center pt-4">
            <h1
              className="text-6xl font-serif font-bold tracking-widest uppercase mb-1"
              style={{ color: BRAND }}
            >
              {data.type === "FORMATION"
                ? "ATTESTATION"
                : data.type === "STAGE"
                  ? "CERTIFICAT"
                  : "DIPLÔME"}
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div
                className="w-12 h-[2px]"
                style={{ backgroundColor: BRAND_ACCENT }}
              ></div>
              <p
                className="text-2xl uppercase tracking-[0.3em] font-medium"
                style={{ color: BRAND_DARK }}
              >
                {data.type === "FORMATION"
                  ? "DE FORMATION"
                  : data.type === "STAGE"
                    ? "DE STAGE"
                    : "DE RÉUSSITE"}
              </p>
              <div
                className="w-12 h-[2px]"
                style={{ backgroundColor: BRAND_ACCENT }}
              ></div>
            </div>
          </div>

          <div
            className="w-32 h-32 rounded-full border-2 p-1 flex flex-col items-center justify-center text-center bg-white shadow-sm overflow-hidden"
            style={{ borderColor: BRAND }}
          >
            {settings?.institutionLogo ? (
              <img
                src={settings.institutionLogo}
                alt="" aria-hidden="true"
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                <div
                  className="text-[10px] uppercase font-black leading-tight px-1"
                  style={{ color: BRAND_DARK }}
                >
                  {settings?.institutionName || "Ferme Agro-Piscicole St André"}
                </div>
                <div
                  className="w-10 h-6 border-y my-1 flex items-center justify-center"
                  style={{ borderColor: BRAND_LIGHT }}
                >
                  🐟
                </div>
                <div
                  className="text-[8px] font-bold uppercase tracking-widest"
                  style={{ color: BRAND }}
                >
                  St Andre
                </div>
              </>
            )}
          </div>
        </div>

        {/* Corps du texte */}
        <div className="doc-block z-10 text-center mt-12 space-y-6 px-24">
          <p className="text-2xl" style={{ color: INK }}>
            {settings?.institutionName || "La Ferme Agro-Piscicole St André"}{" "}
            certifie que {prefix}
          </p>

          <h2
            className={cn(
              "italic py-4 font-extrabold capitalize leading-tight",
              data.fullName.length > 40 ? "text-3xl md:text-4xl" : 
              data.fullName.length > 25 ? "text-4xl md:text-5xl" : "text-6xl"
            )}
            style={{
              fontFamily: "'Charmonman', cursive, serif",
              color: INK,
            }}
          >
            {data.fullName}
          </h2>

          <p
            className="text-2xl leading-relaxed font-medium"
            style={{ color: INK }}
          >
            a suivi avec succès une{" "}
            <span
              className="font-black underline"
              style={{ textDecorationColor: BRAND }}
            >
              Formation en {data.formationName}
            </span>
          </p>

          {data.score !== undefined && data.score > 0 && (
            <p className="text-2xl font-bold italic" style={{ color: BRAND_DARK }}>
              avec une note de {data.score}/100
              {mentionLabel ? <span> ({mentionLabel})</span> : null}
            </p>
          )}

          <p className="text-2xl" style={{ color: INK }}>
            du <span className="font-bold underline">{startDate}</span> au{" "}
            <span className="font-bold underline">{endDate}</span>
          </p>

          <p className="text-xl italic pt-8" style={{ color: MUTED }}>
            Cette attestation est délivrée pour servir et faire valoir ce que de
            droit.
          </p>
        </div>

        {/* Footer */}
        <div className="doc-block z-10 w-full mt-auto mb-10 px-24 flex flex-col items-end">
          <p className="text-lg" style={{ color: INK }}>
            Fait à {settings?.location || "Abomey-Calavi"}, le {issuedDate}
          </p>

          <div className="mt-8 text-center w-64 mr-4">
            <div
              className="w-full h-[1px] mb-2"
              style={{ backgroundColor: LINE }}
            ></div>
            <p
              className="text-xl font-bold uppercase"
              style={{ color: BRAND_DARK }}
            >
              {settings?.instructorTitle || "Le Responsable"}
            </p>
            <div
              className="h-16 flex items-center justify-center text-4xl"
              style={{
                fontFamily: "'Dancing Script', cursive",
                color: BRAND_DARK,
              }}
            >
              {settings?.signatureUrl ? (
                <img
                  src={settings.signatureUrl}
                  alt="Signature"
                  className="max-h-full"
                />
              ) : (
                settings?.instructorName || "Augustin Boko"
              )}
            </div>
            {settings?.signatureUrl && (
              <p
                className="text-sm font-bold mt-2"
                style={{ color: MUTED }}
              >
                {settings.instructorName}
              </p>
            )}
          </div>
        </div>

        {/* Code et QR Code Discret en bas */}
        <div className="absolute bottom-4 w-full flex justify-center items-center gap-10">
          <p
            className="text-xs font-mono tracking-widest uppercase"
            style={{ color: MUTED }}
          >
            code de l&apos;attestation : {data.code}
          </p>
          <div
            className="p-1 bg-white border opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all"
            style={{ borderColor: LINE }}
          >
            <QRCodeSVG value={verificationUrl} size={35} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateTemplate;
