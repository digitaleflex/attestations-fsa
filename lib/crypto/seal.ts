// Scellement HMAC-SHA256 versionné des attestations.
// v1 reste lisible afin de ne pas invalider ni migrer les attestations historiques.
// v2 couvre le document complet, y compris son empreinte PDF.
import { createHmac, timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 16;
export const CERTIFICATE_SEAL_VERSION = 2 as const;
export const CERTIFICATE_SEAL_ALGORITHM = "HMAC-SHA256" as const;
export const SEAL_SECRET_GENERATION_ACTION = "openssl rand -base64 48";

/** Snapshot canonique versionné des champs qui figurent sur le document. */
export interface CertificateSealPayload {
  sealVersion?: number;
  code: string;
  type?: string | null;
  status?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  formationId?: string | null;
  formationName?: string | null;
  fullName: string;
  email?: string | null;
  gender?: string | null;
  birthDate?: Date | string | null;
  birthPlace?: string | null;
  startDate?: Date | string | null;
  endDate: Date | string;
  issuedAt?: Date | string | null;
  location?: string | null;
  instructor?: string | null;
  issuingCompany?: string | null;
  certificationHours?: number | null;
  certificationMention?: string | null;
  certificationObservations?: string | null;
  certificationScore?: number | null;
  stageHours?: number | null;
  stageObservations?: string | null;
  stageScore?: number | null;
  pdfKey?: string | null;
  pdfHash?: string | null;
  pdfVersion?: number | null;
  pdfGeneratedAt?: Date | string | null;
  sealHash?: string | null;
}

export interface CertificateSeal {
  sealHash: string;
  sealedAt: Date;
  sealVersion: number;
}

export interface SealVerification {
  sealed: boolean;
  valid: boolean;
  reason?: string;
  algorithm: typeof CERTIFICATE_SEAL_ALGORITHM;
  sealVersion: number | null;
}

export function getSealSecret(env: string | undefined = process.env.CERT_SEAL_SECRET): string | null {
  const secret = env?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

export interface SealConfigStatus {
  configured: boolean;
  algorithm: typeof CERTIFICATE_SEAL_ALGORITHM;
  reason?: string;
}

export function getSealConfigStatus(
  env: string | undefined = process.env.CERT_SEAL_SECRET,
): SealConfigStatus {
  if (getSealSecret(env)) return { configured: true, algorithm: CERTIFICATE_SEAL_ALGORITHM };
  return {
    configured: false,
    algorithm: CERTIFICATE_SEAL_ALGORITHM,
    reason: env?.trim()
      ? `CERT_SEAL_SECRET trop court (minimum ${MIN_SECRET_LENGTH} caractères)`
      : "CERT_SEAL_SECRET absent ou vide",
  };
}

export function reportSealDisabledIfProduction(
  env: string | undefined = process.env.CERT_SEAL_SECRET,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (nodeEnv !== "production" || getSealSecret(env)) return false;
  console.error(
    `[SEAL] scellement désactivé : ${getSealConfigStatus(env).reason}. ` +
      `Action requise — générez une clé (${SEAL_SECRET_GENERATION_ACTION}) puis définissez CERT_SEAL_SECRET.`,
  );
  return true;
}

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** Snapshot v2. L'ordre des clés est figé. */
function canonicalizeV2(payload: CertificateSealPayload): string {
  return JSON.stringify({
    schemaVersion: CERTIFICATE_SEAL_VERSION,
    code: payload.code ?? "",
    type: payload.type ?? null,
    status: payload.status ?? null,
    sessionId: payload.sessionId ?? null,
    userId: payload.userId ?? null,
    formationId: payload.formationId ?? null,
    formationName: payload.formationName ?? null,
    fullName: payload.fullName ?? "",
    email: payload.email ?? null,
    gender: payload.gender ?? null,
    birthDate: iso(payload.birthDate),
    birthPlace: payload.birthPlace ?? null,
    startDate: iso(payload.startDate),
    endDate: iso(payload.endDate),
    issuedAt: iso(payload.issuedAt),
    location: payload.location ?? null,
    instructor: payload.instructor ?? null,
    issuingCompany: payload.issuingCompany ?? null,
    certificationHours: payload.certificationHours ?? null,
    certificationMention: payload.certificationMention ?? null,
    certificationObservations: payload.certificationObservations ?? null,
    certificationScore: payload.certificationScore ?? null,
    stageHours: payload.stageHours ?? null,
    stageObservations: payload.stageObservations ?? null,
    stageScore: payload.stageScore ?? null,
    pdfKey: payload.pdfKey ?? null,
    pdfHash: payload.pdfHash ?? null,
    pdfVersion: payload.pdfVersion ?? null,
    pdfGeneratedAt: iso(payload.pdfGeneratedAt),
  });
}

/** Sérialisation v1 historique, conservée sans migration des anciennes lignes. */
function canonicalizeV1(payload: CertificateSealPayload): string {
  return JSON.stringify({
    code: payload.code ?? "",
    fullName: payload.fullName ?? "",
    formationName: payload.formationName ?? "",
    certificationScore: payload.certificationScore ?? null,
    certificationMention: payload.certificationMention ?? null,
    endDate: iso(payload.endDate) ?? "",
  });
}

export function canonicalizeSealPayload(payload: CertificateSealPayload): string {
  return payload.sealVersion === CERTIFICATE_SEAL_VERSION
    ? canonicalizeV2(payload)
    : canonicalizeV1(payload);
}

export function computeSealHash(canonicalPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(canonicalPayload, "utf8").digest("hex");
}

export function sealCertificate(
  payload: CertificateSealPayload,
  secret: string | null = getSealSecret(),
  now: Date = new Date(),
): CertificateSeal | null {
  if (!secret) {
    reportSealDisabledIfProduction();
    return null;
  }
  return {
    sealHash: computeSealHash(canonicalizeSealPayload(payload), secret),
    sealedAt: now,
    sealVersion: payload.sealVersion === CERTIFICATE_SEAL_VERSION ? 2 : 1,
  };
}

export function verifyCertificateSeal(
  payload: CertificateSealPayload,
  secret: string | null = getSealSecret(),
): SealVerification {
  if (!payload.sealHash) {
    return { sealed: false, valid: false, reason: "certificat non scellé", algorithm: CERTIFICATE_SEAL_ALGORITHM, sealVersion: null };
  }
  if (!secret) {
    return { sealed: true, valid: false, reason: "clé de scellement indisponible", algorithm: CERTIFICATE_SEAL_ALGORITHM, sealVersion: payload.sealVersion ?? 1 };
  }
  const version = payload.sealVersion === CERTIFICATE_SEAL_VERSION ? 2 : 1;
  const expected = computeSealHash(canonicalizeSealPayload({ ...payload, sealVersion: version }), secret);
  const valid = safeEqualHex(expected, payload.sealHash);
  return {
    sealed: true,
    valid,
    reason: valid ? undefined : "empreinte incohérente : données altérées",
    algorithm: CERTIFICATE_SEAL_ALGORITHM,
    sealVersion: version,
  };
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
