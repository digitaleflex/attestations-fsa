import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  correctionFindMany: vi.fn(),
  correctionFindUnique: vi.fn(),
  correctionUpdate: vi.fn(),
  userUpdate: vi.fn(),
  attestationUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    correctionRequest: {
      findMany: db.correctionFindMany,
      findUnique: db.correctionFindUnique,
      update: db.correctionUpdate,
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        user: { update: db.userUpdate },
        attestation: { update: db.attestationUpdate },
      }),
    ),
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));

import { GET, PATCH } from "../../app/api/admin/corrections/route";

function callGet() {
  return GET(new Request("http://localhost/api/admin/corrections"));
}

function callPatch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/admin/corrections", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  db.correctionFindMany.mockResolvedValue([] as never);
  db.correctionFindUnique.mockResolvedValue({
    id: "corr-1",
    userId: "user-1",
    field: "fullName",
    newValue: "Alice Dupont",
    attestationId: "att-1",
    user: { id: "user-1" },
    attestation: { id: "att-1" },
  } as never);
  db.correctionUpdate.mockResolvedValue({ id: "corr-1", status: "APPROVED" } as never);
  db.userUpdate.mockResolvedValue({ id: "user-1" } as never);
  db.attestationUpdate.mockResolvedValue({ id: "att-1" } as never);
});

describe("GET /api/admin/corrections (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne la liste des demandes", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(db.correctionFindMany).toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/corrections (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPatch({ id: "corr-1", status: "APPROVED" });
    expect(res.status).toBe(401);
  });

  it("400 si données manquantes", async () => {
    const res = await callPatch({ id: "corr-1" });
    expect(res.status).toBe(400);
  });

  it("404 si demande introuvable", async () => {
    db.correctionFindUnique.mockResolvedValue(null as never);
    const res = await callPatch({ id: "corr-x", status: "APPROVED" });
    expect(res.status).toBe(404);
  });

  it("REJECTED → met à jour le statut sans toucher au profil", async () => {
    db.correctionUpdate.mockResolvedValue({ id: "corr-1", status: "REJECTED" } as never);
    const res = await callPatch({ id: "corr-1", status: "REJECTED" });
    expect(res.status).toBe(200);
    expect(db.correctionUpdate).toHaveBeenCalledWith({
      where: { id: "corr-1" },
      data: { status: "REJECTED" },
    });
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("APPROVED → met à jour le profil + l'attestation (transaction)", async () => {
    const res = await callPatch({ id: "corr-1", status: "APPROVED" });
    expect(res.status).toBe(200);
    expect(db.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
    expect(db.attestationUpdate).toHaveBeenCalled();
  });
});