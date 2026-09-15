// lib/crypto/seal.ts
// Scellement cryptographique HMAC-SHA256 des attestations (#155).
//
// Objectif : détecter toute modification hors plateforme d'un enregistrement
// d'attestation (score, mention, identité, formation, date). Le hash est
// calculé à l'émission puis recalculé à la vérification : toute divergence
// signale une altération.
//
// Portée honnête : ce scellement garantit l'INTÉGRITÉ CÔTÉ SERVEUR (valeur
// probante interne). Il ne constitue pas une signature légale qualifiée —
// voir docs/certificate-probative-value.md.
import { createHmac, timingSafeEqual } from "node:crypto";

/** Longueur minimale exigée pour la clé serveur (anti-clé faible). */
const MIN_SECRET_LENGTH = 16;

/** Données canoniques scellées : ce qui est gravé dans l'empreinte. */
export interface CertificateSealPayload {
  code: string;
  fullName: string;
  formationName?: string | null;
  certificationScore?: number | null;
  certificationMention?: string | null;
  endDate: Date | string;
}

export interface CertificateSeal {
  sealHash: string;
  sealedAt: Date;
}

export interface SealVerification {
  /** Une empreinte est présente sur l'attestation. */
  sealed: boolean;
  /** L'empreinte recalculée correspond à l'empreinte stockée. */
  valid: boolean;
  reason?: string;
  algorithm: "HMAC-SHA256";
}

/**
 * Lit la clé de scellement. Renvoie null si absente ou trop courte : le
 * scellement est alors désactivé (jamais d'exception à l'émission).
 */
export function getSealSecret(
  env: string | undefined = process.env.CERT_SEAL_SECRET,
): string | null {
  const secret = env?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

function toIsoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

/**
 * Sérialisation canonique : ordre des clés figé et valeurs normalisées, pour
 * que l'empreinte soit stable entre émission et vérification.
 */
export function canonicalizeSealPayload(payload: CertificateSealPayload): string {
  return JSON.stringify({
    code: payload.code ?? "",
    fullName: payload.fullName ?? "",
    formationName: payload.formationName ?? "",
    certificationScore: payload.certificationScore ?? null,
    certificationMention: payload.certificationMention ?? null,
    endDate: toIsoDate(payload.endDate),
  });
}

/** HMAC-SHA256 hexadécimal sur la sérialisation canonique. */
export function computeSealHash(canonicalPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(canonicalPayload, "utf8").digest("hex");
}

/**
 * Calcule le scellement d'une attestation.
 * @returns null si la clé est indisponible (fonctionnalité dégradée, non bloquante).
 */
export function sealCertificate(
  payload: CertificateSealPayload,
  secret: string | null = getSealSecret(),
  now: Date = new Date(),
): CertificateSeal | null {
  if (!secret) return null;
  const sealHash = computeSealHash(canonicalizeSealPayload(payload), secret);
  return { sealHash, sealedAt: now };
}

/**
 * Vérifie une attestation : recalcule l'empreinte depuis les données
 * actuelles et la compare à l'empreinte stockée (comparaison à temps constant).
 */
export function verifyCertificateSeal(
  payload: CertificateSealPayload & { sealHash?: string | null },
  secret: string | null = getSealSecret(),
): SealVerification {
  const algorithm = "HMAC-SHA256" as const;

  if (!payload.sealHash) {
    return { sealed: false, valid: false, reason: "certificat non scellé", algorithm };
  }
  if (!secret) {
    return {
      sealed: true,
      valid: false,
      reason: "clé de scellement indisponible",
      algorithm,
    };
  }

  const expected = computeSealHash(canonicalizeSealPayload(payload), secret);
  const valid = safeEqualHex(expected, payload.sealHash);
  return {
    sealed: true,
    valid,
    reason: valid ? undefined : "empreinte incohérente : données altérées",
    algorithm,
  };
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
