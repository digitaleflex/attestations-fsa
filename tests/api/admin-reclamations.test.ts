import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  reclamationFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reclamation: { findMany: db.reclamationFindMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET } from "../../app/api/admin/reclamations/route";

function callGet() {
  return GET(new Request("http://localhost/api/admin/reclamations"));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
});

describe("GET /api/admin/reclamations (#138)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne les réclamations avec relations", async () => {
    db.reclamationFindMany.mockResolvedValue([
      { id: "r1", user: { name: "Alice" }, submission: { exam: { title: "Examen" } } },
    ] as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(db.reclamationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("500 si erreur DB", async () => {
    db.reclamationFindMany.mockRejectedValue(new Error("DB down"));
    const res = await callGet();
    expect(res.status).toBe(500);
  });
});