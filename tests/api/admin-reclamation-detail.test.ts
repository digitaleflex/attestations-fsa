import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  reclamationUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reclamation: { update: db.reclamationUpdate },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { PATCH } from "../../app/api/admin/reclamations/[id]/route";

function callPatch(body: unknown) {
  const request = new Request(
    "http://localhost/api/admin/reclamations/rec-1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return PATCH(request, { params: Promise.resolve({ id: "rec-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.reclamationUpdate.mockResolvedValue({
    id: "rec-1",
    status: "RESOLVED",
    adminReply: "Traité",
  } as never);
});

describe("PATCH /api/admin/reclamations/[id] (#138)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPatch({ status: "RESOLVED", adminReply: "OK" });
    expect(res.status).toBe(401);
  });

  it("met à jour la réclamation + audit", async () => {
    const res = await callPatch({ status: "RESOLVED", adminReply: "Traité" });
    expect(res.status).toBe(200);
    expect(db.reclamationUpdate).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: { status: "RESOLVED", adminReply: "Traité" },
    });
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RECLAMATION_REPLY" }),
    );
  });
});