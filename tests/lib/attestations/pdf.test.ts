import { describe, expect, it, vi } from "vitest";
import {
  canonicalPdfHash,
  generateOfficialPdf,
  OfficialPdfUnavailableError,
  type CanonicalPdfGenerator,
  type OfficialPdfProof,
} from "@/lib/attestations/pdf";
import type { StorageDriver } from "@/lib/storage";

const bytes = Buffer.from("%PDF-1.7\ncanonical");
const generator: CanonicalPdfGenerator = {
  generateCanonicalAttestationPdf: vi.fn(async () => bytes),
};

function storage(): StorageDriver {
  return {
    put: vi.fn(async () => undefined),
    getSignedUrl: vi.fn(async () => "https://signed.invalid"),
    delete: vi.fn(async () => undefined),
    exists: vi.fn(async () => true),
  };
}

const snapshot = {
  sealVersion: 2 as const,
  code: "FSA-2026-M09-00001-abcde",
  type: "CERTIFICATION",
  status: "VALIDATED",
  sessionId: "session-1",
  fullName: "Alice",
  endDate: new Date("2026-09-01T10:00:00Z"),
};

describe("service PDF officiel", () => {
  it("stocke un PDF canonique avec pdfKey/pdfHash/pdfVersion/pdfGeneratedAt", async () => {
    const store = storage();
    const now = new Date("2026-09-25T12:00:00Z");
    const proof = await generateOfficialPdf(snapshot, null, {
      generator,
      storage: store,
      now,
      appUrl: "https://fsa.example/",
    });
    const expected: OfficialPdfProof = {
      pdfKey: "attestations/FSA-2026-M09-00001-abcde/v1.pdf",
      pdfHash: canonicalPdfHash(bytes),
      pdfVersion: 1,
      pdfGeneratedAt: now,
    };
    expect(proof).toEqual(expected);
    expect(store.put).toHaveBeenCalledWith(proof.pdfKey, bytes, "application/pdf");
    expect(generator.generateCanonicalAttestationPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationUrl: "https://fsa.example/verifier?code=FSA-2026-M09-00001-abcde",
      }),
    );
  });

  it("incrémente pdfVersion sans écraser le document probant précédent", async () => {
    const store = storage();
    const proof = await generateOfficialPdf(snapshot, 3, { generator, storage: store });
    expect(proof.pdfKey).toContain("/v4.pdf");
    expect(proof.pdfVersion).toBe(4);
  });

  it("refuse une sortie qui n'est pas un PDF", async () => {
    const store = storage();
    await expect(generateOfficialPdf(snapshot, null, {
      generator: { generateCanonicalAttestationPdf: async () => Buffer.from("fake") },
      storage: store,
    })).rejects.toBeInstanceOf(OfficialPdfUnavailableError);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("bloque explicitement sans module générateur serveur", async () => {
    const previous = process.env.ATTESTATION_PDF_GENERATOR_MODULE;
    delete process.env.ATTESTATION_PDF_GENERATOR_MODULE;
    await expect(generateOfficialPdf(snapshot, null, { storage: storage() }))
      .rejects.toThrow("ATTESTATION_PDF_GENERATOR_MODULE");
    if (previous) process.env.ATTESTATION_PDF_GENERATOR_MODULE = previous;
  });
});
