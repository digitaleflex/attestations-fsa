import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  internshipFindUnique: vi.fn(),
  formationFindFirst: vi.fn(),
  formationCreate: vi.fn(),
  settingsFindFirst: vi.fn(),
  attestationCount: vi.fn(),
  attestationCreate: vi.fn(),
  internshipUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    internshipRequest: {
      findUnique: db.internshipFindUnique,
      update: db.internshipUpdate,
    },
    formation: { findFirst: db.formationFindFirst, create: db.formationCreate },
    settings: { findFirst: db.settingsFindFirst },
    attestation: {
      count: db.attestationCount,
      create: db.attestationCreate,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { POST } from "../../app/api/admin/internships/[id]/attestation/route";

function callPost(body: unknown) {
  const request = new NextRequest(
    "http://localhost/api/admin/internships/intern-1/attestation",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return POST(request, { params: Promise.resolve({ id: "intern-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.internshipFindUnique.mockResolvedValue({
    id: "intern-1",
    userId: "user-1",
    fullName: "Alice",
    position: "Pisciculture",
    status: "ACCEPTED",
    user: { id: "user-1", name: "Alice", birthDate: new Date("2000-01-01"), birthPlace: "Cotonou" },
  } as never);
  db.formationFindFirst.mockResolvedValue({ id: "formation-1", name: "Stage" } as never);
  db.settingsFindFirst.mockResolvedValue({ institutionName: "FSA" } as never);
  db.attestationCount.mockResolvedValue(0);
  db.attestationCreate.mockResolvedValue({ id: "att-1", code: "FSA-2026-M09-00001-abcde" } as never);
  db.internshipUpdate.mockResolvedValue({ id: "intern-1" } as never);
});

describe("POST /api/admin/internships/[id]/attestation (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost({ startDate: "2026-01-01", endDate: "2026-06-01" });
    expect(res.status).toBe(401);
  });

  it("404 si demande de stage introuvable", async () => {
    db.internshipFindUnique.mockResolvedValue(null as never);
    const res = await callPost({ startDate: "2026-01-01", endDate: "2026-06-01" });
    expect(res.status).toBe(404);
  });

  it("crée l'attestation de stage + audit", async () => {
    const res = await callPost({
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      location: "Cotonou",
      instructor: "M. X",
      stageScore: 15,
      stageObservations: "Bon travail",
    });
    expect([200, 201]).toContain(res.status);
    expect(db.attestationCreate).toHaveBeenCalled();
    expect(db.internshipUpdate).toHaveBeenCalled();
  });
});