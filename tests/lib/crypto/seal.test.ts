import { describe, it, expect } from "vitest";
import {
  canonicalizeSealPayload,
  computeSealHash,
  getSealSecret,
  sealCertificate,
  verifyCertificateSeal,
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
});
