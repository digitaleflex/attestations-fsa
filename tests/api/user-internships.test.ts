import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  internshipFindMany: vi.fn(),
  internshipCreate: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    internshipRequest: {
      findMany: db.internshipFindMany,
      create: db.internshipCreate,
    },
    user: { findUnique: db.userFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: deps.applyRateLimit,
}));

import { GET } from "../../app/api/user/internships/route";

function callGet() {
  return GET(new Request("http://localhost/api/user/internships"));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  deps.applyRateLimit.mockResolvedValue({ allowed: true } as never);
});

describe("GET /api/user/internships (#138)", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne les candidatures + stats par statut", async () => {
    db.internshipFindMany.mockResolvedValue([
      { id: "i1", status: "PENDING" },
      { id: "i2", status: "PENDING" },
      { id: "i3", status: "ACCEPTED" },
      { id: "i4", status: "REJECTED" },
    ] as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applications).toHaveLength(4);
    expect(body.stats).toEqual({
      total: 4,
      pending: 2,
      inReview: 0,
      accepted: 1,
      rejected: 1,
    });
    expect(db.internshipFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("liste vide → stats à zéro", async () => {
    db.internshipFindMany.mockResolvedValue([] as never);
    const res = await callGet();
    const body = await res.json();
    expect(body.stats.total).toBe(0);
  });
});