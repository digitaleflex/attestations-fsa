import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findUnique: db.attestationFindUnique,
      update: db.attestationUpdate,
    },
    examSession: { deleteMany: db.sessionDeleteMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createNotification: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { POST } from "../../app/api/admin/attestations/[id]/actions/route";

function callActions(body: unknown) {
  const request = new Request(
    "http://localhost/api/admin/attestations/att-1/actions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return POST(request, { params: Promise.resolve({ id: "att-1" }) });
}

function makeAttestation(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    code: "FSA-2026-M09-00001-abcde",
    userId: "user-1",
    formationId: "formation-1",
    status: "VALIDATED",
    formation: { id: "formation-1", name: "Formation A" },
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
  db.attestationUpdate.mockResolvedValue(
    makeAttestation({ status: "REJECTED" }) as never,
  );
  db.sessionDeleteMany.mockResolvedValue({ count: 1 } as never);
});

describe("POST /api/admin/attestations/[id]/actions (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callActions({ action: "REVOKE", reason: "Fraude avérée" });
    expect(res.status).toBe(401);
  });

  it("400 si motif < 5 caractères", async () => {
    const res = await callActions({ action: "REVOKE", reason: "abc" });
    expect(res.status).toBe(400);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("404 si attestation introuvable", async () => {
    db.attestationFindUnique.mockResolvedValue(null as never);
    const res = await callActions({ action: "REVOKE", reason: "Fraude avérée" });
    expect(res.status).toBe(404);
  });

  it("REVOKE → status REJECTED + notification + audit", async () => {
    const res = await callActions({ action: "REVOKE", reason: "Fraude avérée" });
    expect(res.status).toBe(200);
    expect(db.attestationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att-1" },
        data: { status: "REJECTED" },
      }),
    );
    expect(deps.createNotification).toHaveBeenCalled();
    expect(deps.createAuditLog).toHaveBeenCalled();
  });

  it("RETROGRADE → sessions supprimées + status PENDING + scores réinitialisés", async () => {
    db.attestationUpdate.mockResolvedValue(
      makeAttestation({ status: "PENDING" }) as never,
    );
    const res = await callActions({
      action: "RETROGRADE",
      reason: "Examen à repasser",
    });
    expect(res.status).toBe(200);
    expect(db.sessionDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          exam: { formationId: "formation-1" },
        },
      }),
    );
    expect(db.attestationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          certificationScore: 0,
          stageScore: 0,
        }),
      }),
    );
  });
});