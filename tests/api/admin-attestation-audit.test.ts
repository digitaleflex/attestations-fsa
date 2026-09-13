import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  auditLogFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: { findUnique: db.attestationFindUnique },
    auditLog: { findMany: db.auditLogFindMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET } from "../../app/api/admin/attestations/[id]/audit/route";

function callGet() {
  const request = new Request(
    "http://localhost/api/admin/attestations/att-1/audit",
  );
  return GET(request, { params: Promise.resolve({ id: "att-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.attestationFindUnique.mockResolvedValue({ userId: "user-1" } as never);
  db.auditLogFindMany.mockResolvedValue([
    { id: "l1", action: "ATTESTATION_VALIDATED" },
  ] as never);
});

describe("GET /api/admin/attestations/[id]/audit (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne les logs liés (attestation + user)", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(db.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { resourceId: "att-1" },
            { resourceId: "user-1", resource: "USER" },
          ],
        },
        orderBy: { timestamp: "desc" },
      }),
    );
  });

  it("fallback 'none' si attestation introuvable", async () => {
    db.attestationFindUnique.mockResolvedValue(null as never);
    await callGet();
    const call = db.auditLogFindMany.mock.calls[0][0];
    expect(call.where.OR[1].resourceId).toBe("none");
  });
});