import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { sealCertificate } from "@/lib/crypto/seal";
import { attestationSealPayload } from "@/lib/attestations/proof";
import { attestationPdfKey } from "@/lib/attestations/pdf";
import { officialPdfDownloadPath } from "@/lib/attestations/verification-url";

/**
 * GET /api/verifier/pdf — téléchargement du document officiel (#258).
 *
 * Le PDF n'est jamais regénéré ici : la route ne fait que prouver le sceau
 * puis rediriger vers l'URL signée de très courte durée, regénérée à la
 * demande et jamais persistée.
 */

const SEAL_SECRET = "verifier-pdf-test-secret-0123456789";
const CODE = "FSA-2026-M09-00001-abcde";

const db = vi.hoisted(() => ({
  attestationFindFirst: vi.fn(),
  applyRateLimit: vi.fn(),
  getSignedUrl: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { attestation: { findFirst: db.attestationFindFirst } },
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: db.applyRateLimit,
}));

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    getSignedUrl: db.getSignedUrl,
    put: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  }),
  normalizeReadUrlTtl: (value: number) => value,
}));

import { GET } from "../../app/api/verifier/pdf/route";

function sealed(overrides: Record<string, unknown> = {}) {
  const base = {
    id: "a1",
    code: CODE,
    fullName: "Alice",
    type: "CERTIFICATION",
    status: "VALIDATED",
    sessionId: "session-1",
    certificationScore: 88,
    certificationMention: "TRES_BIEN",
    stageScore: 90,
    issuedAt: new Date("2026-09-02T00:00:00Z"),
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-09-02T00:00:00Z"),
    location: "En ligne",
    instructor: "FSA",
    issuingCompany: "FSA",
    formation: { name: "Pisciculture" },
    pdfKey: null,
    pdfHash: null,
    pdfVersion: null,
    pdfGeneratedAt: null,
    sealVersion: 2,
    ...overrides,
  };
  const seal = sealCertificate(attestationSealPayload(base), SEAL_SECRET, new Date("2026-09-02T01:00:00Z"))!;
  return { ...base, sealHash: seal.sealHash, sealedAt: seal.sealedAt };
}

function req(code: string | null) {
  const url = code === null
    ? "http://localhost/api/verifier/pdf"
    : `http://localhost/api/verifier/pdf?code=${encodeURIComponent(code)}`;
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CERT_SEAL_SECRET = SEAL_SECRET;
  db.applyRateLimit.mockResolvedValue({ allowed: true } as never);
  db.getSignedUrl.mockResolvedValue("https://signed.invalid/attestations/x.pdf?X-Amz-Signature=sig");
});

afterEach(() => {
  delete process.env.CERT_SEAL_SECRET;
});

describe("GET /api/verifier/pdf", () => {
  it("refuse un code absent, trop court ou trop long", async () => {
    expect((await GET(req(null))).status).toBe(400);
    expect((await GET(req("FSA"))).status).toBe(400);
    expect((await GET(req("F".repeat(51)))).status).toBe(400);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });

  it("applique le rate limit de vérification avant toute lecture", async () => {
    db.applyRateLimit.mockResolvedValue({ allowed: false, response: new Response("trop lent", { status: 429 }) });
    const res = await GET(req(CODE));
    expect(res.status).toBe(429);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });

  it("404 pour un code inconnu ou un statut non publiable", async () => {
    db.attestationFindFirst.mockResolvedValue(null);
    expect((await GET(req(CODE))).status).toBe(404);

    db.attestationFindFirst.mockResolvedValue(sealed({ status: "PENDING" }));
    expect((await GET(req(CODE))).status).toBe(404);

    db.attestationFindFirst.mockResolvedValue(sealed({ status: "REJECTED" }));
    expect((await GET(req(CODE))).status).toBe(404);
  });

  it("409 tant qu'aucun PDF serveur n'est probant (historique sans pdfKey)", async () => {
    db.attestationFindFirst.mockResolvedValue(sealed({ pdfKey: null }));
    const res = await GET(req(CODE));
    expect(res.status).toBe(409);
    expect(db.getSignedUrl).not.toHaveBeenCalled();
  });

  it("409 si le sceau ne correspond plus aux données servies", async () => {
    // Sceau calculé sur le titulaire d'origine, ligne renvoyée modifiée
    // ensuite en base : c'est exactement le cas d'altération à débusquer.
    const tampered = sealed({ pdfKey: attestationPdfKey(CODE, 1) });
    db.attestationFindFirst.mockResolvedValue({ ...tampered, fullName: "Alice Altérée" });
    const res = await GET(req(CODE));
    expect(res.status).toBe(409);
    expect(db.getSignedUrl).not.toHaveBeenCalled();
  });

  it("409 si la clé de scellement est indisponible : rien ne se télécharge sans preuve", async () => {
    delete process.env.CERT_SEAL_SECRET;
    db.attestationFindFirst.mockResolvedValue(sealed({ pdfKey: attestationPdfKey(CODE, 1) }));
    const res = await GET(req(CODE));
    expect(res.status).toBe(409);
    expect(db.getSignedUrl).not.toHaveBeenCalled();
  });

  it("redirige vers l'URL signée courte, jamais stockée, sans cache", async () => {
    const key = attestationPdfKey(CODE, 2);
    db.attestationFindFirst.mockResolvedValue(sealed({ pdfKey: key, pdfHash: "a".repeat(64), pdfVersion: 2 }));

    const res = await GET(req(CODE));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://signed.invalid/attestations/x.pdf?X-Amz-Signature=sig");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(db.getSignedUrl).toHaveBeenCalledWith(key, 60);
  });

  it("le chemin de téléchargement publié par /api/verifier est exactement celui-ci", () => {
    expect(officialPdfDownloadPath(CODE)).toBe(`/api/verifier/pdf?code=${encodeURIComponent(CODE)}`);
  });
});
