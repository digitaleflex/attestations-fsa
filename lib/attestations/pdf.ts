import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { CertificateSealPayload } from "@/lib/crypto/seal";
import { getStorage, type StorageDriver } from "@/lib/storage";
import { assertSafeKey } from "@/lib/storage/types";
import { attestationVerificationUrl, isAttestationCode } from "@/lib/attestations/verification-url";

/**
 * Contrat du générateur PDF serveur.
 *
 * ATTESTATION_PDF_GENERATOR_MODULE doit pointer vers un module Node exportant :
 * `generateCanonicalAttestationPdf(input): Promise<Uint8Array | Buffer>`.
 * Le module reçoit un snapshot JSON (hors pdfKey/pdfHash) et l'URL publique
 * `/verifier?code=...` à encoder dans le QR. Il ne reçoit ni session ni secret.
 *
 * Aucun générateur navigateur n'est accepté : en son absence l'émission est
 * volontairement bloquée plutôt que de persister un PDF non probant.
 */
export interface CanonicalPdfGenerator {
  generateCanonicalAttestationPdf(input: CanonicalPdfGeneratorInput): Promise<Uint8Array | Buffer>;
}

export interface CanonicalPdfGeneratorInput extends CertificateSealPayload {
  verificationUrl: string;
  pdfVersion: number;
  sealVersion: 2;
}

export interface OfficialPdfProof {
  pdfKey: string;
  pdfHash: string;
  pdfVersion: number;
  pdfGeneratedAt: Date;
}

export class OfficialPdfUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfficialPdfUnavailableError";
  }
}

export function attestationPdfKey(code: string, version: number): string {
  if (!isAttestationCode(code)) throw new Error("Code d'attestation invalide pour le stockage PDF.");
  return `attestations/${code}/v${version}.pdf`;
}

async function loadGenerator(): Promise<CanonicalPdfGenerator> {
  const configured = process.env.ATTESTATION_PDF_GENERATOR_MODULE?.trim();
  if (!configured) {
    throw new OfficialPdfUnavailableError(
      "Génération PDF serveur indisponible : ATTESTATION_PDF_GENERATOR_MODULE n'est pas configurée.",
    );
  }
  const modulePath = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  const loaded = (await import(/* webpackIgnore: true */ pathToFileURL(modulePath).href)) as {
    default?: CanonicalPdfGenerator;
    generateCanonicalAttestationPdf?: CanonicalPdfGenerator["generateCanonicalAttestationPdf"];
  };
  const generate = loaded.generateCanonicalAttestationPdf ?? loaded.default?.generateCanonicalAttestationPdf;
  if (typeof generate !== "function") {
    throw new OfficialPdfUnavailableError(
      "Le module PDF ne respecte pas le contrat generateCanonicalAttestationPdf(input).",
    );
  }
  return { generateCanonicalAttestationPdf: generate };
}

export function canonicalPdfHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function generateOfficialPdf(
  snapshot: CertificateSealPayload,
  previousVersion: number | null | undefined,
  options: {
    appUrl?: string;
    generator?: CanonicalPdfGenerator;
    storage?: StorageDriver;
    now?: Date;
  } = {},
): Promise<OfficialPdfProof> {
  const generator = options.generator ?? (await loadGenerator());
  const storage = options.storage ?? getStorage();
  const version = Math.max(1, (previousVersion ?? 0) + 1);
  const now = options.now ?? new Date();
  const appUrl = (options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const key = attestationPdfKey(snapshot.code, version);
  assertSafeKey(key);
  const input: CanonicalPdfGeneratorInput = {
    ...snapshot,
    sealVersion: 2,
    pdfVersion: version,
    verificationUrl: attestationVerificationUrl(appUrl, snapshot.code),
  };
  const bytes = Buffer.from(await generator.generateCanonicalAttestationPdf(input));
  if (bytes.length < 5 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new OfficialPdfUnavailableError("Le générateur PDF n'a pas produit un document PDF valide.");
  }
  const pdfHash = canonicalPdfHash(bytes);
  await storage.put(key, bytes, "application/pdf");
  return { pdfKey: key, pdfHash, pdfVersion: version, pdfGeneratedAt: now };
}
