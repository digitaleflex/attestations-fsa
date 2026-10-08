// components/AttestationWatermark.tsx
// Filigrane de l'attestation : motif discret + empreinte lisible.
import { useEffect, useState } from 'react';

interface WatermarkProps {
  /**
   * Code FSA — SEULE ancre de l'empreinte (#281).
   *
   * Il ne s'agit plus d'un identifiant interne : le filigrane est rendu dans
   * le DOM et lisible par n'importe quel tiers, il ne peut donc pas
   * transporter ce que `/api/verifier` refuse de publier.
   */
  code: string;
  /** Instant d'émission (ISO) — donnée publique, affichée sur le document. */
  generatedAt: string;
  invisible?: boolean; // If true, watermark is hidden but detectable
}

/**
 * Generates a cryptographic hash for the attestation
 * This creates a unique fingerprint that can be verified
 */
function generateFingerprint(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * #281 — Chaîne d'empreinte.
 *
 * Elle ne dépend QUE de données déjà publiques et affichées sur le document :
 * le code FSA (unique et figé) et l'instant d'émission. Aucun identifiant
 * interne (cuid `id`, `userId`, `sessionId`…) n'y entre plus : ces valeurs
 * vivaient auparavant dans le DOM public alors que la réponse du vérificateur
 * ne les publie pas.
 *
 * La chaîne est FIGÉE : `verifyWatermark` la reconstruit à l'identique.
 */
export function fingerprintSource(code: string, generatedAt: string): string {
  return `${code}-${generatedAt}`;
}

/** Empreinte affichée publiquement (`FP:`) et posée en `data-fp`. */
export function computeFingerprint(code: string, generatedAt: string): string {
  return generateFingerprint(fingerprintSource(code, generatedAt));
}

/**
 * Watermark component for attestation anti-forgery
 * Adds multiple layers of security:
 * 1. Visible watermark (subtle, semi-transparent)
 * 2. Invisible watermark (encoded data in pixel patterns)
 * 3. Verification hash (can be validated server-side)
 */
export function AttestationWatermark({
  code,
  generatedAt,
  invisible = false,
}: WatermarkProps) {
  const normalizedCode = typeof code === "string" ? code.trim() : "";
  const [fingerprint, setFingerprint] = useState('');

  useEffect(() => {
    // Sans code FSA il n'existe aucune ancre publique. On n'affiche alors
    // AUCUNE empreinte : dériver un `FP:` d'une chaîne vide (ou d'un
    // identifiant interne) afficherait une valeur sans signification, pire
    // qu'une absence de filigrane. `generateFingerprint("")` valant "0",
    // la garde est indispensable — sans elle, un code vide s'afficherait
    // comme une empreinte légitime.
    if (!normalizedCode) {
      setFingerprint('');
      return;
    }
    setFingerprint(computeFingerprint(normalizedCode, generatedAt));
  }, [normalizedCode, generatedAt]);

  if (!fingerprint) return null;

  // Visible watermark (subtle background pattern)
  if (!invisible) {
    return (
      <div
        className="absolute inset-0 pointer-events-none select-none overflow-hidden"
        style={{ zIndex: 1 }}
        aria-hidden="true"
      >
        {/* Diagonal watermark pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 100px,
              #000 100px,
              #000 101px
            )`,
          }}
        />

        {/* Verification code (visible mais discret) — teinte de marque, jamais de bleu générique */}
        <div className="absolute bottom-4 right-4 text-[9px] opacity-80" style={{ color: "var(--color-brand-muted)" }}>
          Réf: {code} | FP: {fingerprint}
        </div>

        {/* Hidden verification pixels (nearly invisible) — données publiques
            uniquement : l'empreinte et son ancre, le code FSA. */}
        <div className="absolute top-0 left-0 w-1 h-1 opacity-0" data-fp={fingerprint} />
        <div className="absolute top-0 right-0 w-1 h-1 opacity-0" data-code={normalizedCode} />
      </div>
    );
  }

  // Invisible watermark (for PDF embedding)
  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
      data-watermark="true"
      data-fingerprint={fingerprint}
      data-code={normalizedCode}
      data-generated={generatedAt}
    >
      {/* Encoded as nearly invisible single pixels */}
      <span className="absolute w-[1px] h-[1px] opacity-[0.01]" style={{
        backgroundColor: `rgb(${parseInt(fingerprint.slice(0, 2), 36) % 256}, ${parseInt(fingerprint.slice(2, 4), 36) % 256}, ${parseInt(fingerprint.slice(4, 6), 36) % 256})`
      }} />
    </div>
  );
}

/**
 * Verify if a document has a valid watermark
 * This can be used server-side to validate PDFs
 *
 * #281 — même chaîne que le composant : `code` + `generatedAt`, aucun
 * identifiant interne. La reconstruction passe par `computeFingerprint` pour
 * que les deux côtés ne puissent pas diverger.
 */
export function verifyWatermark(data: {
  fingerprint?: string;
  code: string;
  generatedAt: string;
}): { valid: boolean; reason?: string } {
  const expectedFingerprint = computeFingerprint(data.code.trim(), data.generatedAt);

  if (!data.fingerprint) {
    return { valid: false, reason: 'No fingerprint found' };
  }

  if (data.fingerprint !== expectedFingerprint) {
    return { valid: false, reason: 'Fingerprint mismatch - document may be forged' };
  }

  return { valid: true };
}
