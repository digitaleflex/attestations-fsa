import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  attestationFindMany: vi.fn(),
  userFindMany: vi.fn(),
  attestationGroupBy: vi.fn(),
  settingsFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findMany: db.attestationFindMany,
      groupBy: db.attestationGroupBy,
    },
    user: { findMany: db.userFindMany },
    settings: { findFirst: db.settingsFindFirst },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET } from "../../app/api/admin/dashboard/stats/route";

function callGet() {
  return GET(new Request("http://localhost/api/admin/dashboard/stats"));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.attestationFindMany.mockResolvedValue([
    { issuedAt: new Date(), type: "CERTIFICATION", status: "VALIDATED" },
  ] as never);
  db.userFindMany.mockResolvedValue([{ createdAt: new Date() }] as never);
  db.attestationGroupBy.mockResolvedValue([
    { type: "CERTIFICATION", _count: { id: 10 } },
  ] as never);
  db.settingsFindFirst.mockResolvedValue({
    targetInscriptions: 200,
    targetAttestations: 100,
    targetValidations: 80,
  } as never);
});

describe("GET /api/admin/dashboard/stats (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne séries, distribution et cibles", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    // 6 mois de séries
    expect(body.series.registrations).toHaveLength(6);
    expect(body.series.attestations).toHaveLength(6);
    expect(body.series.validations).toHaveLength(6);
    expect(body.distribution).toEqual([{ type: "CERTIFICATION", count: 10 }]);
    expect(body.targets).toEqual({
      inscriptions: 200,
      attestations: 100,
      validations: 80,
    });
  });

  it("cibles par défaut si settings absent", async () => {
    db.settingsFindFirst.mockResolvedValue(null as never);
    const res = await callGet();
    const body = await res.json();
    expect(body.targets).toEqual({
      inscriptions: 100,
      attestations: 50,
      validations: 40,
    });
  });

  it("500 si erreur DB", async () => {
    db.attestationFindMany.mockRejectedValue(new Error("DB down"));
    const res = await callGet();
    expect(res.status).toBe(500);
  });
});