import { vi, describe, it, expect, beforeEach } from "vitest";

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

import { GET } from "../../app/api/admin/attestations/export/route";

function callGet() {
  return GET(new Request("http://localhost/api/admin/attestations/export"));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.attestationFindMany.mockResolvedValue([
    {
      id: "a1",
      code: "FSA-2026-M09-00001-abcde",
      type: "CERTIFICATION",
      status: "VALIDATED",
      fullName: "Alice",
      user: { email: "alice@example.com" },
      formation: { name: "Formation A" },
      gender: "F",
      location: "Cotonou",
      instructor: "M. X",
      issuingCompany: "FSA",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-01"),
      issuedAt: new Date("2026-06-01"),
      certificationScore: 80,
      stageScore: 15,
    },
  ] as never);
});

describe("GET /api/admin/attestations/export (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("génère un fichier xlsx", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(db.attestationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { issuedAt: "desc" } }),
    );
    // Content-Type xlsx ou disposition en pièce jointe
    const ct = res.headers.get("content-type") || "";
    const cd = res.headers.get("content-disposition") || "";
    expect(ct + cd).toMatch(/spreadsheet|xlsx|attachment/i);
  });
});