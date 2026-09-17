import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  formationFindFirst: vi.fn(),
  formationCreate: vi.fn(),
  attestationCount: vi.fn(),
  attestationCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { findFirst: db.formationFindFirst, create: db.formationCreate },
    attestation: {
      count: db.attestationCount,
      create: db.attestationCreate,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { POST } from "../../app/api/attestations/route";

function callPost(body: unknown) {
  const request = new Request("http://localhost/api/attestations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

const CERT_BODY = {
  fullName: "Alice Doe",
  birthDate: "2000-01-01",
  birthPlace: "Cotonou",
  formation: "Pisciculture",
  startDate: "2026-01-01",
  endDate: "2026-06-01",
  location: "Cotonou",
  instructor: "M. X",
  issuingCompany: "FSA",
  type: "CERTIFICATION",
  certificationScore: 88,
  certificationMention: "TRES_BIEN",
};

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.formationFindFirst.mockResolvedValue({
    id: "formation-1",
    name: "Pisciculture",
  } as never);
  db.attestationCount.mockResolvedValue(0);
  db.attestationCreate.mockResolvedValue({
    id: "att-1",
    code: "FSA-2026-M09-00001-abcde",
  } as never);
});

afterEach(() => {
  delete process.env.CERT_SEAL_SECRET;
});

describe("POST /api/attestations — scellement #155 (correctif B)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost(CERT_BODY);
    expect(res.status).toBe(401);
    expect(db.attestationCreate).not.toHaveBeenCalled();
  });

  it("scelle une attestation CERTIFICATION (sealHash conforme) quand clé configurée", async () => {
    process.env.CERT_SEAL_SECRET = "attestations-test-secret-0123456789abcdef";
    const res = await callPost(CERT_BODY);
    expect(res.status).toBe(201);

    const createArgs = db.attestationCreate.mock.calls[0][0] as {
      data: { sealHash?: string; sealedAt?: Date; type?: string };
    };
    expect(createArgs.data.type).toBe("CERTIFICATION");
    expect(createArgs.data.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createArgs.data.sealedAt).toBeInstanceOf(Date);
  });

  it("scelle une attestation STAGE (sealHash conforme) quand clé configurée", async () => {
    process.env.CERT_SEAL_SECRET = "attestations-test-secret-0123456789abcdef";
    const res = await callPost({
      ...CERT_BODY,
      type: "STAGE",
      stageScore: 15,
      stageHours: 120,
      certificationScore: undefined,
      certificationMention: undefined,
    });
    expect(res.status).toBe(201);

    const createArgs = db.attestationCreate.mock.calls[0][0] as {
      data: { sealHash?: string; sealedAt?: Date; type?: string };
    };
    expect(createArgs.data.type).toBe("STAGE");
    expect(createArgs.data.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createArgs.data.sealedAt).toBeInstanceOf(Date);
  });

  it("crée l'attestation sans throw même sans clé (non bloquant)", async () => {
    delete process.env.CERT_SEAL_SECRET;
    const res = await callPost(CERT_BODY);
    expect(res.status).toBe(201);

    const createArgs = db.attestationCreate.mock.calls[0][0] as {
      data: { sealHash?: string };
    };
    expect(createArgs.data.sealHash).toBeUndefined();
  });
});
