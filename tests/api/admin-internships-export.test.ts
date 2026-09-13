import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  internshipFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    internshipRequest: { findMany: db.internshipFindMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET } from "../../app/api/admin/internships/export/route";

function callGet(query = "") {
  return GET(
    new NextRequest(`http://localhost/api/admin/internships/export${query}`),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.internshipFindMany.mockResolvedValue([
    {
      id: "i1",
      fullName: "Alice",
      email: "a@b.c",
      phone: "+229",
      position: "Dev",
      university: "UNSTIM",
      level: "L3",
      status: "PENDING",
      createdAt: new Date(),
    },
  ] as never);
});

describe("GET /api/admin/internships/export (#138)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("génère un xlsx de toutes les demandes", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(db.internshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("filtre par statut si fourni", async () => {
    await callGet("?status=ACCEPTED");
    expect(db.internshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACCEPTED" } }),
    );
  });

  it("status=ALL → pas de filtre", async () => {
    await callGet("?status=ALL");
    expect(db.internshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});