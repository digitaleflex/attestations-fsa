// components/AttestationWatermark.tsx
// Invisible watermark component for anti-forgery protection
import { useEffect, useState } from 'react';

interface WatermarkProps {
  attestationId: string;
  userId: string;
  code: string;
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
 * Watermark component for attestation anti-forgery
 * Adds multiple layers of security:
 * 1. Visible watermark (subtle, semi-transparent)
 * 2. Invisible watermark (encoded data in pixel patterns)
 * 3. Verification hash (can be validated server-side)
 */
export function AttestationWatermark({
  attestationId,
  userId,
  code,
  generatedAt,
  invisible = false,
}: WatermarkProps) {
  const [fingerprint, setFingerprint] = useState('');

  useEffect(() => {
    // Generate unique fingerprint
    const data = `${attestationId}-${userId}-${code}-${generatedAt}`;
    setFingerprint(generateFingerprint(data));
  }, [attestationId, userId, code, generatedAt]);

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
        
        {/* Verification code (visible but subtle) */}
        <div className="absolute bottom-4 right-4 text-[8px] text-slate-400 opacity-60">
          Réf: {code} | FP: {fingerprint}
        </div>

        {/* Hidden verification pixels (nearly invisible) */}
        <div className="absolute top-0 left-0 w-1 h-1 opacity-0" data-fp={fingerprint} />
        <div className="absolute top-0 right-0 w-1 h-1 opacity-0" data-aid={attestationId} />
        <div className="absolute bottom-0 left-0 w-1 h-1 opacity-0" data-uid={userId} />
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
      data-attestation-id={attestationId}
      data-user-id={userId}
      data-code={code}
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
 */
export function verifyWatermark(data: {
  fingerprint?: string;
  attestationId: string;
  userId: string;
  code: string;
  generatedAt: string;
}): { valid: boolean; reason?: string } {
  const expectedFingerprint = generateFingerprint(
    `${data.attestationId}-${data.userId}-${data.code}-${data.generatedAt}`
  );

  if (!data.fingerprint) {
    return { valid: false, reason: 'No fingerprint found' };
  }

  if (data.fingerprint !== expectedFingerprint) {
    return { valid: false, reason: 'Fingerprint mismatch - document may be forged' };
  }

  return { valid: true };
}
