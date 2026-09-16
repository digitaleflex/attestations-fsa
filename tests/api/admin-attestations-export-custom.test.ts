import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  attestationFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: { findMany: db.attestationFindMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { POST } from "../../app/api/admin/attestations/export-custom/route";

function callPost(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/admin/attestations/export-custom", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.attestationFindMany.mockResolvedValue([
    {
      id: "a1",
      code: "FSA-2026-M09-00001-abcde",
      fullName: "Alice",
      type: "CERTIFICATION",
      status: "VALIDATED",
      issuedAt: new Date("2026-06-01"),
      certificationScore: 80,
      stageScore: 15,
      location: "Cotonou",
      instructor: "M. X",
      formation: { name: "Formation A" },
    },
  ] as never);
});

describe("POST /api/admin/attestations/export-custom (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost({ ids: ["a1"], columns: ["fullName"] });
    expect(res.status).toBe(401);
  });

  it("400 si aucun ID", async () => {
    const res = await callPost({ ids: [], columns: ["fullName"] });
    expect(res.status).toBe(400);
    expect(db.attestationFindMany).not.toHaveBeenCalled();
  });

  it("génère un xlsx avec les colonnes demandées", async () => {
    const res = await callPost({
      ids: ["a1"],
      columns: ["fullName", "code", "certificationScore"],
    });
    expect(res.status).toBe(200);
    expect(db.attestationFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["a1"] } },
      include: { formation: true, user: true },
    });
    const ct = res.headers.get("content-type") || "";
    expect(ct).toMatch(/spreadsheet/i);
  });
});