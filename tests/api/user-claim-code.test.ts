import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  attestationFindFirst: vi.fn(),
  attestationUpdate: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findFirst: db.attestationFindFirst,
      update: db.attestationUpdate,
    },
    user: { update: db.userUpdate },
    $transaction: db.transaction,
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { POST } from "../../app/api/user/claim-code/route";

function callClaimCode(body: unknown) {
  return POST(
    new Request("http://localhost/api/user/claim-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function makeAttestation(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    code: "FSA-2026-ABCDE",
    fullName: "Alice Dupont",
    birthDate: new Date("2000-01-02T00:00:00.000Z"),
    birthPlace: "Douala",
    gender: "F",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1", role: "user" } as never);
  db.attestationFindFirst.mockResolvedValue(makeAttestation() as never);
  db.transaction.mockResolvedValue([] as never);
  db.attestationUpdate.mockResolvedValue({} as never);
  db.userUpdate.mockResolvedValue({} as never);
});

describe("POST /api/user/claim-code", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callClaimCode({ codePart: "ABCDE" });
    expect(res.status).toBe(401);
  });

  it("403 si l'utilisateur est administrateur", async () => {
    deps.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
    } as never);
    const res = await callClaimCode({ codePart: "ABCDE" });
    expect(res.status).toBe(403);
  });

  it("400 si le code est trop court", async () => {
    const res = await callClaimCode({ codePart: "AB" });
    expect(res.status).toBe(400);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });

  it("404 si aucune attestation ne correspond", async () => {
    db.attestationFindFirst.mockResolvedValue(null as never);
    const res = await callClaimCode({ codePart: "ABCDE" });
    expect(res.status).toBe(404);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("code court (<=5) → recherche par suffixe + liaison atomique", async () => {
    const res = await callClaimCode({ codePart: "abcde" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.fullName).toBe("Alice Dupont");
    expect(db.attestationFindFirst).toHaveBeenCalledWith({
      where: { code: { endsWith: "abcde" }, userId: null, status: "VALIDATED" },
    });
    expect(db.transaction).toHaveBeenCalled();
    expect(db.attestationUpdate).toHaveBeenCalledWith({
      where: { id: "att-1" },
      data: { userId: "user-1" },
    });
    expect(db.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
  });

  it("code long (>5) → recherche exacte", async () => {
    db.attestationFindFirst.mockResolvedValue(
      makeAttestation({ code: "fsa-2026-abcde" }) as never,
    );
    const res = await callClaimCode({ codePart: "FSA-2026-ABCDE" });
    expect(res.status).toBe(200);
    expect(db.attestationFindFirst).toHaveBeenCalledWith({
      where: { code: "fsa-2026-abcde", userId: null, status: "VALIDATED" },
    });
  });

  it("500 si la recherche échoue", async () => {
    db.attestationFindFirst.mockRejectedValue(new Error("db down") as never);
    const res = await callClaimCode({ codePart: "ABCDE" });
    expect(res.status).toBe(500);
  });
});
