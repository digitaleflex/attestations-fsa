import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  userGroupBy: vi.fn(),
  formationFindMany: vi.fn(),
  sessionGroupBy: vi.fn(),
  formationCount: vi.fn(),
  sessionCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { groupBy: db.userGroupBy },
    formation: { findMany: db.formationFindMany, count: db.formationCount },
    examSession: { groupBy: db.sessionGroupBy, count: db.sessionCount },
  },
}));

const deps = vi.hoisted(() => ({
  isAdminAuthenticated: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAdminAuthenticated: deps.isAdminAuthenticated,
}));

import { GET } from "../../app/api/admin/stats/advanced/route";

function callGet() {
  return GET(new Request("http://localhost/api/admin/stats/advanced"));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.isAdminAuthenticated.mockResolvedValue(true as never);
  db.userGroupBy.mockResolvedValue([] as never);
  db.formationFindMany.mockResolvedValue([
    { id: "f1", name: "Formation A", _count: { attestations: 3 } },
  ] as never);
  db.sessionGroupBy.mockResolvedValue([
    { status: "COMPLETED", _count: 4 },
  ] as never);
  db.formationCount.mockResolvedValue(1);
  db.sessionCount.mockResolvedValue(4);
});

describe("GET /api/admin/stats/advanced (#137)", () => {
  it("401 si non admin", async () => {
    deps.isAdminAuthenticated.mockResolvedValue(false as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne dailyUsers, formationStats, sessionStats et summary", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dailyUsers).toHaveLength(30); // 30 derniers jours
    expect(Array.isArray(body.formationStats)).toBe(true);
    expect(Array.isArray(body.sessionStats)).toBe(true);
    expect(body.summary).toEqual({
      totalFormations: 1,
      totalSubmissions: 4,
      totalMissions: 0,
    });
  });

  it("500 si erreur DB", async () => {
    db.formationCount.mockRejectedValue(new Error("DB down"));
    const res = await callGet();
    expect(res.status).toBe(500);
  });
});