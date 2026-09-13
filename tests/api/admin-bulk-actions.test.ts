import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        attestation: {
          findUnique: db.attestationFindUnique,
          update: db.attestationUpdate,
        },
        examSession: { deleteMany: db.sessionDeleteMany },
      }),
    ),
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
  createNotification: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: deps.applyRateLimit,
}));

import { POST } from "../../app/api/admin/attestations/bulk-actions/route";

function callPost(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/admin/attestations/bulk-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.applyRateLimit.mockResolvedValue({ allowed: true } as never);
  db.attestationFindUnique.mockResolvedValue({
    id: "att-1",
    userId: "user-1",
    formationId: "formation-1",
    formation: { name: "Formation A" },
  } as never);
  db.attestationUpdate.mockResolvedValue({ id: "att-1", status: "REJECTED" } as never);
  db.sessionDeleteMany.mockResolvedValue({ count: 1 } as never);
});

describe("POST /api/admin/attestations/bulk-actions (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost({ ids: ["att-1"], action: "REVOKE" });
    expect(res.status).toBe(401);
  });

  it("400 si aucun ID", async () => {
    const res = await callPost({ ids: [], action: "REVOKE" });
    expect(res.status).toBe(400);
  });

  it("REVOKE → status REJECTED + notification", async () => {
    const res = await callPost({ ids: ["att-1"], action: "REVOKE" });
    expect(res.status).toBe(200);
    expect(db.attestationUpdate).toHaveBeenCalledWith({
      where: { id: "att-1" },
      data: { status: "REJECTED" },
    });
    expect(deps.createNotification).toHaveBeenCalled();
  });

  it("RETROGRADE → sessions supprimées + status PENDING", async () => {
    db.attestationUpdate.mockResolvedValue({ id: "att-1", status: "PENDING" } as never);
    const res = await callPost({ ids: ["att-1"], action: "RETROGRADE" });
    expect(res.status).toBe(200);
    expect(db.sessionDeleteMany).toHaveBeenCalled();
    expect(db.attestationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", certificationScore: 0 }),
      }),
    );
  });

  it("429 si rate-limité", async () => {
    const response = new Response(JSON.stringify({ error: "Trop de requêtes" }), {
      status: 429,
    });
    deps.applyRateLimit.mockResolvedValue({
      allowed: false,
      response,
    } as never);
    const res = await callPost({ ids: ["att-1"], action: "REVOKE" });
    expect(res.status).toBe(429);
  });
});