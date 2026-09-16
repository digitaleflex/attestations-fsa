import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: { findMany: db.examFindMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET } from "../../app/api/admin/exams/route";

function callGet() {
  return GET(new Request("http://localhost/api/admin/exams"));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
});

describe("GET /api/admin/exams (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne la liste des examens avec formation", async () => {
    db.examFindMany.mockResolvedValue([
      { id: "e1", title: "Examen A", formation: { name: "F1", category: "INFO" } },
    ] as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(db.examFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("500 si erreur DB", async () => {
    db.examFindMany.mockRejectedValue(new Error("DB down"));
    const res = await callGet();
    expect(res.status).toBe(500);
  });
});