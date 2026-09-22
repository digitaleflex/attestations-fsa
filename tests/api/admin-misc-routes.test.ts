import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
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

import { GET as submissionDetail } from "../../app/api/admin/submissions/[id]/route";

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" } as never);
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.isAdminAuthenticated.mockResolvedValue(true as never);
  db.sessionFindUnique.mockResolvedValue({
    id: "s1",
    scorePart1: 18,
    candidate: { id: "u1", name: "Alice" },
    exam: { parts: [] },
    scans: [],
  } as never);
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
