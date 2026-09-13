import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  auditLogFindMany: vi.fn(),
  securityLogFindMany: vi.fn(),
  securityLogCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { findMany: db.auditLogFindMany },
    securityLog: { findMany: db.securityLogFindMany, count: db.securityLogCount },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET as logsGet } from "../../app/api/admin/logs/route";

function callLogs() {
  return logsGet(new Request("http://localhost/api/admin/logs"));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
});

describe("GET /api/admin/logs (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callLogs();
    expect(res.status).toBe(401);
  });

  it("retourne les 200 derniers logs avec user", async () => {
    db.auditLogFindMany.mockResolvedValue([
      { id: "l1", action: "EXAM_CREATED", user: { name: "Admin", email: "a@b.c" } },
    ] as never);
    const res = await callLogs();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(db.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { timestamp: "desc" },
        take: 200,
      }),
    );
  });

  it("500 si erreur DB", async () => {
    db.auditLogFindMany.mockRejectedValue(new Error("DB down"));
    const res = await callLogs();
    expect(res.status).toBe(500);
  });
});