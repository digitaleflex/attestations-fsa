import { vi, describe, it, expect, beforeEach } from "vitest";

// #301 — Cette suite couvre le socle (authentification, motif, action inconnue)
// et le refus sur une attestation supprimée logiquement. Le détail du contrat
// non destructif (REVOKED, archivage des sessions, notification des anonymes)
// est couvert par tests/api/attestation-lifecycle-301.test.ts.
const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
  sessionUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findUnique: db.attestationFindUnique,
      update: db.attestationUpdate,
    },
    examSession: { deleteMany: db.sessionDeleteMany, updateMany: db.sessionUpdateMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createNotification: vi.fn(),
  notifyAllAdmins: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
  notifyAllAdmins: deps.notifyAllAdmins,
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
    sessionId: "session-1",
    formationId: "formation-1",
    status: "VALIDATED",
    deletedAt: null,
    formation: { id: "formation-1", name: "Formation A" },
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.notifyAllAdmins.mockResolvedValue([] as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
  db.attestationUpdate.mockResolvedValue(
    makeAttestation({ status: "REVOKED" }) as never,
  );
  db.sessionUpdateMany.mockResolvedValue({ count: 1 } as never);
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

  it("REVOKE → statut REVOKED + notification + audit, sans suppression", async () => {
    const res = await callActions({ action: "REVOKE", reason: "Fraude avérée" });
    expect(res.status).toBe(200);
    expect(db.attestationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att-1" },
        data: expect.objectContaining({ status: "REVOKED", revokeReason: "Fraude avérée" }),
      }),
    );
    expect(db.sessionDeleteMany).not.toHaveBeenCalled();
    expect(deps.createNotification).toHaveBeenCalled();
    expect(deps.createAuditLog).toHaveBeenCalled();
  });

  it("RETROGRADE → sessions archivées (jamais supprimées) + statut PENDING", async () => {
    db.attestationUpdate.mockResolvedValue(
      makeAttestation({ status: "PENDING" }) as never,
    );
    const res = await callActions({
      action: "RETROGRADE",
      reason: "Examen à repasser",
    });
    expect(res.status).toBe(200);
    expect(db.sessionDeleteMany).not.toHaveBeenCalled();
    expect(db.sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ARCHIVED", archiveReason: "Examen à repasser" }),
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
