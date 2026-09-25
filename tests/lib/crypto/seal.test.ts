import { describe, it, expect, vi, afterEach } from "vitest";
import {
  canonicalizeSealPayload,
  computeSealHash,
  getSealConfigStatus,
  getSealSecret,
  reportSealDisabledIfProduction,
  sealCertificate,
  verifyCertificateSeal,
  SEAL_SECRET_GENERATION_ACTION,
  type CertificateSealPayload,
} from "@/lib/crypto/seal";

const SECRET = "unit-test-secret-0123456789abcdef";

const basePayload: CertificateSealPayload = {
  code: "FSA-2026-M09-00001-abcde",
  fullName: "Alice Doe",
  formationName: "Pisciculture",
  certificationScore: 88,
  certificationMention: "TRES_BIEN",
  endDate: new Date("2026-09-01T10:00:00Z"),
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("lib/crypto/seal (#155)", () => {
  it("getSealSecret refuse une clé absente ou trop courte", () => {
    expect(getSealSecret(undefined)).toBeNull();
    expect(getSealSecret("")).toBeNull();
    expect(getSealSecret("trop-court")).toBeNull();
    expect(getSealSecret(SECRET)).toBe(SECRET);
  });

  it("scelle une attestation et produit un hash SHA-256 hexadécimal", () => {
    const now = new Date("2026-09-01T10:00:00Z");
    const seal = sealCertificate(basePayload, SECRET, now);
    expect(seal).not.toBeNull();
    expect(seal!.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(seal!.sealedAt).toEqual(now);
  });

  it("ne scelle pas (null) si la clé est indisponible — non bloquant", () => {
    expect(sealCertificate(basePayload, null)).toBeNull();
  });

  it("vérifie un sceau intact comme valide", () => {
    const seal = sealCertificate(basePayload, SECRET)!;
    const result = verifyCertificateSeal(
      { ...basePayload, sealHash: seal.sealHash },
      SECRET,
    );
    expect(result.sealed).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("détecte un certificat modifié (score altéré) comme invalide", () => {
    const seal = sealCertificate(basePayload, SECRET)!;
    // Simulation d'une retouche : le score en base diffère de celui scellé.
    const result = verifyCertificateSeal(
      { ...basePayload, certificationScore: 100, sealHash: seal.sealHash },
      SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("altér");
  });

  it("invalide si la clé de vérification diffère", () => {
    const seal = sealCertificate(basePayload, SECRET)!;
    const result = verifyCertificateSeal(
      { ...basePayload, sealHash: seal.sealHash },
      "autre-cle-secrete-0123456789abcdef",
    );
    expect(result.valid).toBe(false);
  });

  it("signale un certificat non scellé", () => {
    const result = verifyCertificateSeal(basePayload, SECRET);
    expect(result.sealed).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("certificat non scellé");
  });

  it("sérialisation canonique stable et indépendante de l'ordre d'objet", () => {
    const a = canonicalizeSealPayload(basePayload);
    const b = canonicalizeSealPayload({
      endDate: basePayload.endDate,
      certificationMention: basePayload.certificationMention,
      certificationScore: basePayload.certificationScore,
      formationName: basePayload.formationName,
      fullName: basePayload.fullName,
      code: basePayload.code,
    });
    expect(a).toBe(b);
    expect(computeSealHash(a, SECRET)).toBe(computeSealHash(b, SECRET));
  });
  it("v2 détecte la mutation de tout champ significatif couvert", () => {
    const payload: CertificateSealPayload = {
      ...basePayload,
      sealVersion: 2,
      type: "CERTIFICATION",
      status: "VALIDATED",
      sessionId: "session-1",
      formationId: "formation-1",
      location: "En ligne",
      pdfKey: "attestations/FSA/v1.pdf",
      pdfHash: "b".repeat(64),
      pdfVersion: 1,
    };
    const seal = sealCertificate(payload, SECRET)!;
    expect(seal.sealVersion).toBe(2);
    for (const mutation of [
      { sessionId: "session-2" },
      { status: "REJECTED" },
      { location: "Cotonou" },
      { pdfHash: "c".repeat(64) },
    ]) {
      expect(verifyCertificateSeal({ ...payload, ...mutation, sealHash: seal.sealHash }, SECRET).valid).toBe(false);
    }
  });
});

describe("seal — dégradation bruyante en production (#155)", () => {
  it("getSealConfigStatus décrit l'état sans exposer la clé", () => {
    expect(getSealConfigStatus(SECRET)).toEqual({
      configured: true,
      algorithm: "HMAC-SHA256",
    });

    const missing = getSealConfigStatus(undefined);
    expect(missing.configured).toBe(false);
    expect(missing.reason).toContain("absent");

    const tooShort = getSealConfigStatus("trop-court");
    expect(tooShort.configured).toBe(false);
    expect(tooShort.reason).toContain("trop court");
    // La clé n'est jamais renvoyée dans le diagnostic.
    expect(JSON.stringify(tooShort)).not.toContain("trop-court");
  });

  it("dev/test : la clé absente reste silencieuse (sceau optionnel)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(reportSealDisabledIfProduction(undefined, "test")).toBe(false);
    expect(sealCertificate(basePayload, null)).toBeNull();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("prod : la clé absente produit un log error actionnable", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(reportSealDisabledIfProduction(undefined, "production")).toBe(true);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const message = String(errorSpy.mock.calls[0][0]);
    expect(message).toContain("scellement désactivé");
    expect(message).toContain(SEAL_SECRET_GENERATION_ACTION);
    expect(message).toContain("CERT_SEAL_SECRET");
  });

  it("prod : l'émission déclenche le log (via sealCertificate) sans throw", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CERT_SEAL_SECRET", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const seal = sealCertificate(basePayload);

    expect(seal).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain("scellement désactivé");
  });

  it("prod : une clé valide reste silencieuse et scelle normalement", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CERT_SEAL_SECRET", SECRET);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const seal = sealCertificate(basePayload);

    expect(seal).not.toBeNull();
    expect(seal!.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
