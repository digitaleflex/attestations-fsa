import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  securityFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  securityCount: vi.fn(),
  sessionCount: vi.fn(),
  userCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    securityLog: { findMany: db.securityFindMany, count: db.securityCount },
    auditLog: { findMany: db.auditFindMany },
    examSession: { count: db.sessionCount },
    user: { count: db.userCount },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET } from "../../app/api/admin/monitoring/route";

function callGet(query = "") {
  return GET(new Request(`http://localhost/api/admin/monitoring${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.securityFindMany.mockResolvedValue([{ id: "s1" }] as never);
  db.auditFindMany.mockResolvedValue([{ id: "a1" }] as never);
  db.securityCount.mockResolvedValue(2);
  db.sessionCount.mockResolvedValue(5);
  db.userCount.mockResolvedValue(50);
});

describe("GET /api/admin/monitoring (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne logs + stats agrégées", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.securityLogs).toHaveLength(1);
    expect(body.auditLogs).toHaveLength(1);
    expect(body.stats).toEqual(
      expect.objectContaining({
        highSeverityCount: 2,
        totalExamsCompleted: 5,
        totalCandidates: 50,
      }),
    );
  });

  it("respecte le paramètre limit", async () => {
    await callGet("?limit=10");
    expect(db.securityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("filtre par severity si fourni", async () => {
    await callGet("?severity=HIGH");
    expect(db.securityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { severity: "HIGH" } }),
    );
  });
});