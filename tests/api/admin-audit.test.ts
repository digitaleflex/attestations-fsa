import { vi, describe, it, expect, beforeEach } from "vitest";

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { POST } from "../../app/api/admin/audit/route";

function callPost(body: unknown) {
  return POST(
    new Request("http://localhost/api/admin/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1", name: "Admin" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
});

describe("POST /api/admin/audit (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost({ action: "X", resource: "Y", resourceId: "Z" });
    expect(res.status).toBe(401);
  });

  it("400 si champs manquants", async () => {
    const res = await callPost({ action: "X" });
    expect(res.status).toBe(400);
    expect(deps.createAuditLog).not.toHaveBeenCalled();
  });

  it("log l'action admin + audit", async () => {
    const res = await callPost({
      action: "EXAM_CREATED",
      resource: "EXAM",
      resourceId: "exam-1",
      details: { note: "test" },
    });
    expect(res.status).toBe(200);
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EXAM_CREATED",
        resource: "EXAM",
        resourceId: "exam-1",
        newValue: expect.objectContaining({ adminId: "admin-1", adminName: "Admin" }),
      }),
    );
  });
});