import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examSessionFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findUnique: db.examSessionFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
// handleApiError est importé depuis @/lib/errors (ou équivalent) — on le neutralise.
vi.mock("@/lib/error-handler", () => ({
  handleApiError: vi.fn(() =>
    new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500 }),
  ),
}));

import { GET } from "../../app/api/admin/submissions/[id]/scans/route";

function callGet() {
  const request = new Request(
    "http://localhost/api/admin/submissions/sub-1/scans",
  );
  return GET(request, { params: Promise.resolve({ id: "sub-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
});

describe("GET /api/admin/submissions/[id]/scans (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("404 si soumission introuvable", async () => {
    db.examSessionFindUnique.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  it("200 — retourne les scans triés par page", async () => {
    db.examSessionFindUnique.mockResolvedValue({
      id: "sub-1",
      scans: [
        { id: "s1", pageNumber: 1, fileName: "p1.pdf" },
        { id: "s2", pageNumber: 2, fileName: "p2.pdf" },
      ],
    } as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scans).toHaveLength(2);
    expect(db.examSessionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        include: expect.objectContaining({
          scans: { orderBy: { pageNumber: "asc" } },
        }),
      }),
    );
  });
});