import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    internshipRequest: { findMany: db.findMany, count: db.count },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { GET } from "../../app/api/admin/internships/export/route";

function callGet(query = "") {
  return GET(
    new NextRequest(`http://localhost/api/admin/internships/export${query}`),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.findMany.mockResolvedValue([
    {
      id: "i1",
      fullName: "Alice",
      email: "a@b.c",
      phone: "+229",
      position: "Dev",
      university: null,
      level: null,
      status: "PENDING",
      message: null,
      cvUrl: null,
      cvKey: "cv/1.pdf",
      createdAt: new Date("2026-01-02T00:00:00Z"),
    },
  ] as never);
  db.count.mockResolvedValue(120 as never);
});

describe("#267 — GET /api/admin/internships/export (pagination + audit)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    expect((await callGet()).status).toBe(401);
    expect(deps.createAuditLog).not.toHaveBeenCalled();
  });

  it("défauts : page 1, pageSize 50", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0, where: {} }),
    );
    expect(res.headers.get("X-Total-Count")).toBe("120");
    expect(res.headers.get("X-Page-Size")).toBe("50");
    expect(res.headers.get("X-Total-Pages")).toBe("3");
  });

  it("pagine : take/skip cohérents avec page & pageSize", async () => {
    await callGet("?page=3&pageSize=25");
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25, skip: 50 }),
    );
  });

  it("filtre par statut transmis au count", async () => {
    await callGet("?status=ACCEPTED");
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACCEPTED" } }),
    );
    expect(db.count).toHaveBeenCalledWith({ where: { status: "ACCEPTED" } });
  });

  it("400 si le filtre de statut est invalide (pas de fuite de données)", async () => {
    const res = await callGet("?status=TOUT");
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_QUERY");
    expect(db.findMany).not.toHaveBeenCalled();
    expect(deps.createAuditLog).not.toHaveBeenCalled();
  });

  it("audite l'export (action dédiée + pagination + filtre)", async () => {
    await callGet("?page=2&pageSize=25&status=REVIEWING");
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "INTERNSHIP_EXPORTED",
        resource: "INTERNSHIP_REQUEST",
        newValue: { page: 2, pageSize: 25, total: 120, status: "REVIEWING" },
      }),
    );
  });

  it("pageSize d'export borné à 500", async () => {
    await callGet("?pageSize=100000");
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });
});
