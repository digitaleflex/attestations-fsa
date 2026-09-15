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

/** Commande à communiquer à l'exploitant quand la clé de scellement manque. */
export const SEAL_SECRET_GENERATION_ACTION = "openssl rand -base64 48";

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
 *
 * Cette fonction reste volontairement tolérante : c'est aux points d'appel
 * critiques (émission, sonde de disponibilité) de décider si l'absence de clé
 * est un incident — voir reportSealDisabledIfProduction / getSealConfigStatus.
 */
export function getSealSecret(
  env: string | undefined = process.env.CERT_SEAL_SECRET,
): string | null {
  const secret = env?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

/** État de configuration du scellement (jamais la valeur de la clé). */
export interface SealConfigStatus {
  /** Une clé exploitable est présente. */
  configured: boolean;
  algorithm: "HMAC-SHA256";
  /** Cause de l'indisponibilité (diagnostic) quand non configurée. */
  reason?: string;
}

/**
 * Diagnostic de configuration du scellement, sans exception et sans exposer la
 * clé : destiné à la sonde de disponibilité /api/ready.
 */
export function getSealConfigStatus(
  env: string | undefined = process.env.CERT_SEAL_SECRET,
): SealConfigStatus {
  if (getSealSecret(env)) {
    return { configured: true, algorithm: "HMAC-SHA256" };
  }
  const reason = env?.trim()
    ? `CERT_SEAL_SECRET trop court (minimum ${MIN_SECRET_LENGTH} caractères)`
    : "CERT_SEAL_SECRET absent ou vide";
  return { configured: false, algorithm: "HMAC-SHA256", reason };
}

/**
 * En production, une clé de scellement absente/invalide est un INCIDENT : les
 * attestations émises perdraient silencieusement leur valeur probante. On le
 * trace explicitement au niveau error au lieu de dégrader sans bruit. En
 * dev/test, le scellement reste optionnel et cette fonction est muette.
 *
 * @returns true si un incident de configuration a été signalé.
 */
export function reportSealDisabledIfProduction(
  env: string | undefined = process.env.CERT_SEAL_SECRET,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (nodeEnv !== "production" || getSealSecret(env)) return false;
  console.error(
    `[SEAL] scellement désactivé : ${getSealConfigStatus(env).reason}. ` +
      `Action requise — générez une clé (${SEAL_SECRET_GENERATION_ACTION}) ` +
      `puis définissez CERT_SEAL_SECRET. Sans sceau, les attestations émises ` +
      `perdent leur valeur probante.`,
  );
  return true;
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
 *
 * Ne lève jamais : si la clé est indisponible, renvoie null (émission
 * préservée). Toutefois, en production, cet état est signalé au niveau error
 * — centralisé ici pour couvrir TOUS les points d'émission, pas seulement
 * lib/attestations/issue.ts.
 *
 * @returns null si la clé est indisponible (fonctionnalité dégradée, non bloquante).
 */
export function sealCertificate(
  payload: CertificateSealPayload,
  secret: string | null = getSealSecret(),
  now: Date = new Date(),
): CertificateSeal | null {
  if (!secret) {
    reportSealDisabledIfProduction();
    return null;
  }
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
