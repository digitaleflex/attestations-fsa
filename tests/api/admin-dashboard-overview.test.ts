import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  userCount: vi.fn(),
  reportCount: vi.fn(),
  attestationCount: vi.fn(),
  sessionCount: vi.fn(),
  attestationFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: db.userCount },
    report: { count: db.reportCount },
    attestation: { count: db.attestationCount, findMany: db.attestationFindMany },
    examSession: { count: db.sessionCount },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET } from "../../app/api/admin/dashboard/overview/route";

function callGet() {
  return GET(new Request("http://localhost/api/admin/dashboard/overview"));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  // user.count appelé 3× (total, newThisMonth, admins)
  db.userCount
    .mockResolvedValueOnce(100)
    .mockResolvedValueOnce(12)
    .mockResolvedValueOnce(3);
  db.reportCount.mockResolvedValue(5);
  db.attestationCount.mockResolvedValue(42);
  db.sessionCount.mockResolvedValue(30);
  db.attestationFindMany.mockResolvedValue([
    { id: "a1", code: "FSA-2026-M09-00001-abcde", formation: { name: "F1" } },
  ] as never);
});

describe("GET /api/admin/dashboard/overview (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("agrège users / actionable / pedagogy", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toEqual({
      total: 100,
      newThisMonth: 12,
      admins: 3,
      candidates: 97, // total - admins
    });
    expect(body.actionable).toEqual({ pendingPortfolios: 0, newReports: 5 });
    expect(body.pedagogy.totalAttestations).toBe(42);
    expect(body.pedagogy.validatedExams).toBe(30);
    expect(body.pedagogy.recentAttestations).toHaveLength(1);
  });

  it("500 si erreur DB", async () => {
    db.attestationCount.mockRejectedValue(new Error("DB down"));
    const res = await callGet();
    expect(res.status).toBe(500);
  });
});