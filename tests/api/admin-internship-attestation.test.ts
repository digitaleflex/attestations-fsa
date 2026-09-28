import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  internshipFindUnique: vi.fn(),
  internshipUpdateMany: vi.fn(),
  formationFindFirst: vi.fn(),
  formationCreate: vi.fn(),
  settingsFindFirst: vi.fn(),
  attestationCount: vi.fn(),
  attestationCreate: vi.fn(),
  attestationFindFirst: vi.fn(),
  internshipUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  // #265 — l'émission passe désormais par une transaction sérialisable :
  // le client transactionnel est le même jeu de mocks.
  const tx = {
    internshipRequest: {
      findUnique: db.internshipFindUnique,
      update: db.internshipUpdate,
      updateMany: db.internshipUpdateMany,
    },
    formation: { findFirst: db.formationFindFirst, create: db.formationCreate },
    settings: { findFirst: db.settingsFindFirst },
    attestation: {
      count: db.attestationCount,
      create: db.attestationCreate,
      findFirst: db.attestationFindFirst,
    },
  };
  return { prisma: { ...tx, $transaction: (fn: (client: unknown) => unknown) => fn(tx) } };
});

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { POST } from "../../app/api/admin/internships/[id]/attestation/route";

function callPost(body: unknown) {
  const request = new NextRequest(
    "http://localhost/api/admin/internships/intern-1/attestation",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return POST(request, { params: Promise.resolve({ id: "intern-1" }) });
}

const SEAL_SECRET = "internship-test-secret-0123456789abcdef";

beforeEach(() => {
  vi.clearAllMocks();
  // #288 — le scellement est désormais obligatoire : la clé est configurée
  // pour tout le fichier, y compris pour les tests d'émission « nominale ».
  process.env.CERT_SEAL_SECRET = SEAL_SECRET;
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.internshipFindUnique.mockResolvedValue({
    id: "intern-1",
    userId: "user-1",
    fullName: "Alice",
    position: "Pisciculture",
    status: "ACCEPTED",
    createdAt: new Date("2025-12-01T00:00:00.000Z"),
    user: { id: "user-1", name: "Alice", birthDate: new Date("2000-01-01"), birthPlace: "Cotonou" },
  } as never);
  db.formationFindFirst.mockResolvedValue({ id: "formation-1", name: "Stage" } as never);
  db.settingsFindFirst.mockResolvedValue({
    institutionName: "FSA",
    location: "Abomey-Calavi",
    instructorName: "Directeur Technique",
  } as never);
  db.attestationCount.mockResolvedValue(0);
  db.attestationFindFirst.mockResolvedValue(null as never);
  db.attestationCreate.mockResolvedValue({ id: "att-1", code: "FSA-2026-M09-00001-abcde" } as never);
  db.internshipUpdate.mockResolvedValue({ id: "intern-1" } as never);
  db.internshipUpdateMany.mockResolvedValue({ count: 1 } as never);
});

afterEach(() => {
  delete process.env.CERT_SEAL_SECRET;
});

describe("POST /api/admin/internships/[id]/attestation (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost({ startDate: "2026-01-01", endDate: "2026-06-01" });
    expect(res.status).toBe(401);
  });

  it("404 si demande de stage introuvable", async () => {
    db.internshipFindUnique.mockResolvedValue(null as never);
    const res = await callPost({ startDate: "2026-01-01", endDate: "2026-06-01" });
    expect(res.status).toBe(404);
  });

  it("crée l'attestation de stage + audit", async () => {
    const res = await callPost({
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      location: "Cotonou",
      instructor: "M. X",
      stageScore: 15,
      stageObservations: "Bon travail",
    });
    expect([200, 201]).toContain(res.status);
    expect(db.attestationCreate).toHaveBeenCalled();
    expect(db.internshipUpdateMany).toHaveBeenCalled();
  });

  it("scelle l'attestation STAGE (sealHash + sealedAt) quand clé configurée (#155)", async () => {
    const res = await callPost({
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      stageScore: 15,
    });
    expect([200, 201]).toContain(res.status);

    const createArgs = db.attestationCreate.mock.calls[0][0] as {
      data: { sealHash?: string; sealedAt?: Date };
    };
    expect(createArgs.data.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createArgs.data.sealedAt).toBeInstanceOf(Date);
  });

  // #288 — l'ancien comportement « pas de clé => attestation créée non
  // scellée, en silence » était un trou de preuve. L'émission est désormais
  // refusée en dur, et la demande n'est pas davantage archivée.
  it("refuse d'émettre sans clé de scellement (aucune ligne non scellée) (#288)", async () => {
    delete process.env.CERT_SEAL_SECRET;
    const res = await callPost({
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      stageScore: 15,
    });
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: "CONFIGURATION_MISSING",
      message: expect.stringContaining("clé de scellement indisponible"),
    });
    expect(db.attestationCreate).not.toHaveBeenCalled();
    expect(db.internshipUpdateMany).not.toHaveBeenCalled();
  });
});