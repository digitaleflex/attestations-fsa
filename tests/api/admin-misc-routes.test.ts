import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examFindMany: vi.fn(),
  reportCount: vi.fn(),
  sessionFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: { findMany: db.examFindMany },
    report: { count: db.reportCount },
    examSession: { findUnique: db.sessionFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  isAdminAuthenticated: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
  isAdminAuthenticated: deps.isAdminAuthenticated,
}));

import { GET as examsList } from "../../app/api/admin/exams/list/route";
import { GET as sidebarCounts } from "../../app/api/admin/sidebar-counts/route";
import { GET as submissionDetail } from "../../app/api/admin/submissions/[id]/route";

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" } as never);
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.isAdminAuthenticated.mockResolvedValue(true as never);
  db.examFindMany.mockResolvedValue([
    { id: "e1", title: "E1", formation: { name: "F1" } },
  ] as never);
  db.reportCount.mockResolvedValue(4);
  db.sessionFindUnique.mockResolvedValue({
    id: "s1",
    scorePart1: 18,
    candidate: { id: "u1", name: "Alice" },
    exam: { parts: [] },
    scans: [],
  } as never);
});

describe("GET /api/admin/exams/list (#137)", () => {
  it("401 si non admin", async () => {
    deps.getCurrentUser.mockResolvedValue({ id: "u", role: "user" } as never);
    const res = await examsList(new Request("http://localhost/api/admin/exams/list"));
    expect(res.status).toBe(401);
  });

  it("retourne les examens OFFICIAL", async () => {
    const res = await examsList(new Request("http://localhost/api/admin/exams/list"));
    expect(res.status).toBe(200);
    expect(db.examFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: "OFFICIAL" } }),
    );
  });
});

describe("GET /api/admin/sidebar-counts (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await sidebarCounts(
      new Request("http://localhost/api/admin/sidebar-counts"),
    );
    expect(res.status).toBe(401);
  });

  it("retourne les compteurs", async () => {
    const res = await sidebarCounts(
      new Request("http://localhost/api/admin/sidebar-counts"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ pendingPortfolios: 0, newReports: 4 });
  });
});

describe("GET /api/admin/submissions/[id] (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await submissionDetail(
      new Request("http://localhost/api/admin/submissions/s1"),
      { params: Promise.resolve({ id: "s1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("404 si soumission introuvable", async () => {
    db.sessionFindUnique.mockResolvedValue(null as never);
    const res = await submissionDetail(
      new Request("http://localhost/api/admin/submissions/x"),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(res.status).toBe(404);
  });

  it("200 — expose qcmScore (alias scorePart1)", async () => {
    const res = await submissionDetail(
      new Request("http://localhost/api/admin/submissions/s1"),
      { params: Promise.resolve({ id: "s1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.qcmScore).toBe(18);
  });
});