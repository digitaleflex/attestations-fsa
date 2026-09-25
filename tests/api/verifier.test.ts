import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { sealCertificate } from "@/lib/crypto/seal";

const SEAL_SECRET = "verifier-test-secret-0123456789abcdef";

function sealedAttestation() {
  const endDate = new Date("2026-01-02");
  const base = {
    id: "a1",
    code: "FSA-2026-M01-00001-abcde",
    fullName: "Alice",
    type: "CERTIFICATION",
    status: "VALIDATED",
    certificationScore: 88,
    certificationMention: "TRES_BIEN",
    stageScore: 90,
    issuedAt: new Date("2026-01-02"),
    startDate: new Date("2026-01-01"),
    endDate,
    location: "En ligne",
    instructor: "FSA",
    formation: { name: "Pisciculture", category: "AGRICULTURE" },
  };
  const seal = sealCertificate(
    {
      code: base.code,
      fullName: base.fullName,
      formationName: base.formation.name,
      certificationScore: base.certificationScore,
      certificationMention: base.certificationMention,
      endDate,
    },
    SEAL_SECRET,
  )!;
  return {
    ...base,
    sealHash: seal.sealHash,
    sealedAt: seal.sealedAt,
  };
}

const db = vi.hoisted(() => ({
  attestationFindFirst: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { attestation: { findFirst: db.attestationFindFirst } },
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: db.applyRateLimit,
}));

vi.mock("@/lib/sanitization", () => ({
  sanitizeInput: (value: string) => value,
}));

import { GET } from "../../app/api/verifier/route";

function req(code?: string) {
  const url = code
    ? `http://localhost/api/verifier?code=${encodeURIComponent(code)}`
    : "http://localhost/api/verifier";
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CERT_SEAL_SECRET = SEAL_SECRET;
  db.applyRateLimit.mockResolvedValue({ allowed: true } as never);
});

describe("GET /api/verifier", () => {
  it("400 si le code est absent ou trop court", async () => {
    const missing = await GET(req());
    expect(missing.status).toBe(400);

    const tooShort = await GET(req("abc"));
    expect(tooShort.status).toBe(400);
  });

  it("404 si aucun certificat ne correspond", async () => {
    db.attestationFindFirst.mockResolvedValue(null as never);
    const res = await GET(req("FSA-2026-M01-00001-abcde"));
    expect(res.status).toBe(404);
  });

  it("interroge aussi le statut REJECTED, sinon `revoked` mentirait (#224)", async () => {
    db.attestationFindFirst.mockResolvedValue(null as never);
    await GET(req("FSA-2026-M01-00001-abcde"));

    expect(db.attestationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: expect.arrayContaining(["REJECTED"]) },
        }),
      }),
    );
  });

  it("déclare explicitement la révocation d'une attestation REJECTED (#224)", async () => {
    db.attestationFindFirst.mockResolvedValue({
      id: "a2",
      code: "FSA-2026-M01-00002-abcde",
      fullName: "Bob",
      type: "CERTIFICATION",
      status: "REJECTED",
      certificationScore: null,
      stageScore: null,
      certificationMention: null,
      sealHash: null,
      sealedAt: null,
      issuedAt: new Date("2026-02-01"),
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-02-01"),
      location: "En ligne",
      instructor: "FSA",
      formation: { name: "Pisciculture", category: "AGRICULTURE" },
    } as never);

    const res = await GET(req("FSA-2026-M01-00002-abcde"));
    // Le certificat existe : on ne renvoie PAS un 404 « introuvable ».
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.attestation.status).toBe("REJECTED");
    expect(body.attestation.proof.revoked).toBe(true);
    expect(body.attestation.proof.valid).toBe(false);
    expect(typeof body.attestation.proof.reason).toBe("string");
    expect(body.attestation.proof.reason.length).toBeGreaterThan(0);
    // Divulgation minimale : pas de données personnelles d'un titulaire rejeté.
    expect(body.attestation.fullName).toBeUndefined();
  });

  it("200 et mappe certificationScore -> score quand trouvé", async () => {
    db.attestationFindFirst.mockResolvedValue({
      id: "a1",
      code: "FSA-2026-M01-00001-abcde",
      fullName: "Alice",
      type: "CERTIFICATION",
      status: "VALIDATED",
      certificationScore: 88,
      stageScore: 90,
      issuedAt: new Date("2026-01-02"),
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-02"),
      location: "En ligne",
      instructor: "FSA",
      formation: { name: "Pisciculture", category: "AGRICULTURE" },
    } as never);

    const res = await GET(req("FSA-2026-M01-00001-abcde"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.attestation.score).toBe(88);
    expect(body.attestation.code).toBe("FSA-2026-M01-00001-abcde");
  });

  it("mappe stageScore -> score lorsque le certificat n'a pas de score de certification", async () => {
    db.attestationFindFirst.mockResolvedValue({
      id: "a3",
      code: "FSA-2026-M01-00003-abcde",
      fullName: "Chloé",
      type: "STAGE",
      status: "VALIDATED",
      certificationScore: null,
      stageScore: 91,
      certificationMention: null,
      sealHash: null,
      sealedAt: null,
      issuedAt: new Date("2026-02-01"),
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-02-01"),
      location: "En ligne",
      instructor: "FSA",
      formation: { name: "Pisciculture", category: "AGRICULTURE" },
    } as never);

    const res = await GET(req("FSA-2026-M01-00003-abcde"));
    expect(res.status).toBe(200);
    expect((await res.json()).attestation.score).toBe(91);
  });

  it("expose une preuve de scellement valide (#155)", async () => {
    db.attestationFindFirst.mockResolvedValue(sealedAttestation() as never);

    const res = await GET(req("FSA-2026-M01-00001-abcde"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.attestation.proof.sealed).toBe(true);
    expect(body.attestation.proof.valid).toBe(true);
    expect(body.attestation.proof.algorithm).toBe("HMAC-SHA256");
    expect(body.attestation.proof.revoked).toBe(false);
    expect(typeof body.attestation.proof.checkedAt).toBe("string");
  });

  it("signale une preuve invalide si le certificat a été retouché (#155)", async () => {
    // Le score en base a changé mais l'empreinte d'origine est conservée.
    db.attestationFindFirst.mockResolvedValue({
      ...sealedAttestation(),
      certificationScore: 100,
    } as never);

    const res = await GET(req("FSA-2026-M01-00001-abcde"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.attestation.proof.sealed).toBe(true);
    expect(body.attestation.proof.valid).toBe(false);
  });

  it("respecte le rate limiting (renvoie la réponse 429)", async () => {
    db.applyRateLimit.mockResolvedValue({
      allowed: false,
      response: NextResponse.json(
        { error: "Trop de requêtes" },
        { status: 429 },
      ),
    } as never);

    const res = await GET(req("FSA-2026-M01-00001-abcde"));
    expect(res.status).toBe(429);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });
});
