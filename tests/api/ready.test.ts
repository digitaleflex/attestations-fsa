import { vi, describe, it, expect, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]) },
}));

import { GET as healthGET } from "../../app/api/health/route";
import {
  canonicalizeSealPayload,
  computeSealHash,
  getSealSecret,
  sealCertificate,
  verifyCertificateSeal,
  type CertificateSealPayload,
} from "@/lib/crypto/seal";

const VALID_SECRET = "ready-probe-secret-0123456789abcdef";

const payload: CertificateSealPayload = {
  code: "FSA-2026-M09-00042-abcde",
  fullName: "Alice Doe",
  formationName: "Pisciculture",
  certificationScore: 88,
  certificationMention: "TRES_BIEN",
  endDate: new Date("2026-09-01T10:00:00Z"),
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete process.env.CERT_SEAL_SECRET;
});

describe("/api/health — liveness (#155)", () => {
  it("reste 200 en production même sans CERT_SEAL_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = healthGET();

    expect(res.status).toBe(200);
  });
});

describe("sonde indépendante — déterminisme de l'empreinte (#155)", () => {
  it("même charge utile + même clé → même sealHash", () => {
    const a = sealCertificate(payload, VALID_SECRET);
    const b = sealCertificate(payload, VALID_SECRET);

    expect(a).not.toBeNull();
    expect(a!.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a!.sealHash).toBe(b!.sealHash);
  });

  it("un seul caractère modifié change l'empreinte", () => {
    const base = sealCertificate(payload, VALID_SECRET)!.sealHash;
    const altered = sealCertificate(
      { ...payload, fullName: "Alice Doé" },
      VALID_SECRET,
    )!.sealHash;

    expect(altered).not.toBe(base);
  });

  it("l'empreinte dépend de la clé (rotation détectée)", () => {
    const a = sealCertificate(payload, VALID_SECRET)!.sealHash;
    const b = sealCertificate(payload, "autre-secret-0123456789abcdef")!.sealHash;

    expect(a).not.toBe(b);
  });

  it("le log d'incident prod ne contient jamais la clé fournie", () => {
    vi.stubEnv("NODE_ENV", "production");
    const weak = "abc123";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const seal = sealCertificate(payload, getSealSecret(weak));

    expect(seal).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = String(errorSpy.mock.calls[0][0]);
    expect(message).toContain("scellement désactivé");
    expect(message).not.toContain(weak);
  });

  it("FAUX POSITIF CONSTATÉ : un renommage légitime invalide tous les sceaux", () => {
    const seal = sealCertificate(payload, VALID_SECRET)!;

    const afterRename = verifyCertificateSeal(
      { ...payload, formationName: "Pisciculture (renommée)", sealHash: seal.sealHash },
      VALID_SECRET,
    );

    expect(afterRename.sealed).toBe(true);
    expect(afterRename.valid).toBe(false);
    expect(afterRename.reason).toBe("empreinte incohérente : données altérées");
  });

  it("un score inchangé reste valide (pas de faux positif sur arrondi)", () => {
    const seal = sealCertificate({ ...payload, certificationScore: 88 }, VALID_SECRET)!;
    const res = verifyCertificateSeal(
      { ...payload, certificationScore: 88.0, sealHash: seal.sealHash },
      VALID_SECRET,
    );
    expect(res.valid).toBe(true);
  });

  it("canonicalisation insensible à l'ordre des clés, null normalisés", () => {
    const a = canonicalizeSealPayload({
      code: "c",
      fullName: "n",
      endDate: "2026-09-01T10:00:00.000Z",
    });
    const b = canonicalizeSealPayload({
      fullName: "n",
      endDate: "2026-09-01T10:00:00.000Z",
      code: "c",
    });

    expect(a).toBe(b);
    expect(a).toContain('"certificationScore":null');
    expect(computeSealHash(a, VALID_SECRET)).toBe(computeSealHash(b, VALID_SECRET));
  });
});
