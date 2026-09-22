import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findUnique: db.attestationFindUnique,
      update: db.attestationUpdate,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { POST } from "../../app/api/user/attestations/[id]/claim/route";
import { makeRequest } from "../helpers/request";

function callClaim() {
  return POST(makeRequest({}), { params: Promise.resolve({ id: "att-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  db.attestationFindUnique.mockResolvedValue({
    userId: "user-1",
    status: "VALIDATED",
  } as never);
  db.attestationUpdate.mockResolvedValue({
    id: "att-1",
    status: "CLAIMED",
  } as never);
});

describe("POST /api/user/attestations/[id]/claim", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callClaim();
    expect(res.status).toBe(401);
  });

  it("404 si attestation introuvable", async () => {
    db.attestationFindUnique.mockResolvedValue(null as never);
    const res = await callClaim();
    expect(res.status).toBe(404);
  });

  it("403 si l'attestation appartient à un autre utilisateur", async () => {
    db.attestationFindUnique.mockResolvedValue({
      userId: "user-2",
      status: "VALIDATED",
    } as never);
    const res = await callClaim();
    expect(res.status).toBe(403);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("VALIDATED → passe en CLAIMED", async () => {
    const res = await callClaim();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(db.attestationUpdate).toHaveBeenCalledWith({
      where: { id: "att-1" },
      data: { status: "CLAIMED" },
    });
  });

  it("statut non VALIDATED → aucun update, succès idempotent", async () => {
    db.attestationFindUnique.mockResolvedValue({
      userId: "user-1",
      status: "CLAIMED",
    } as never);
    const res = await callClaim();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("500 si la lecture échoue", async () => {
    db.attestationFindUnique.mockRejectedValue(new Error("db down") as never);
    const res = await callClaim();
    expect(res.status).toBe(500);
  });
});
