import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  correctionCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: { findUnique: db.attestationFindUnique },
    correctionRequest: { create: db.correctionCreate },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { POST } from "../../app/api/user/attestations/[id]/correction/route";
import { makeRequest } from "../helpers/request";

function callCorrection(body: unknown) {
  return POST(makeRequest(body), { params: Promise.resolve({ id: "att-1" }) });
}

function makeAttestation(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    userId: "user-1",
    fullName: "Alice Dupont",
    birthDate: new Date("2000-01-02T00:00:00.000Z"),
    birthPlace: "Douala",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
  db.correctionCreate.mockResolvedValue({ id: "corr-1" } as never);
});

describe("POST /api/user/attestations/[id]/correction", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callCorrection({ field: "fullName", newValue: "Bob" });
    expect(res.status).toBe(401);
  });

  it("400 si champ ou nouvelle valeur manquant", async () => {
    const res = await callCorrection({ field: "fullName" });
    expect(res.status).toBe(400);
    expect(db.correctionCreate).not.toHaveBeenCalled();
  });

  it("404 si attestation introuvable", async () => {
    db.attestationFindUnique.mockResolvedValue(null as never);
    const res = await callCorrection({ field: "fullName", newValue: "Bob" });
    expect(res.status).toBe(404);
  });

  it("404 si l'attestation appartient à un autre utilisateur", async () => {
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ userId: "user-2" }) as never,
    );
    const res = await callCorrection({ field: "fullName", newValue: "Bob" });
    expect(res.status).toBe(404);
    expect(db.correctionCreate).not.toHaveBeenCalled();
  });

  it("happy path fullName → crée la demande avec l'ancienne valeur", async () => {
    const res = await callCorrection({
      field: "fullName",
      newValue: "Alice Martin",
      reason: "changement de nom",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("corr-1");
    expect(db.correctionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        attestationId: "att-1",
        field: "fullName",
        oldValue: "Alice Dupont",
        newValue: "Alice Martin",
        status: "PENDING",
      }),
    });
  });

  it("happy path birthDate → ancienne valeur formatée ISO (yyyy-mm-dd)", async () => {
    const res = await callCorrection({
      field: "birthDate",
      newValue: "2001-03-04",
    });
    expect(res.status).toBe(200);
    expect(db.correctionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        field: "birthDate",
        oldValue: "2000-01-02",
      }),
    });
  });

  it("500 si la création de la demande échoue", async () => {
    db.correctionCreate.mockRejectedValue(new Error("db down") as never);
    const res = await callCorrection({
      field: "birthPlace",
      newValue: "Yaoundé",
    });
    expect(res.status).toBe(500);
  });
});
