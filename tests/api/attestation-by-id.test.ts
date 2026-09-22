import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
  attestationDelete: vi.fn(),
  formationFindFirst: vi.fn(),
  formationCreate: vi.fn(),
  examSessionFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findUnique: db.attestationFindUnique,
      update: db.attestationUpdate,
      delete: db.attestationDelete,
    },
    formation: {
      findFirst: db.formationFindFirst,
      create: db.formationCreate,
    },
    examSession: { findFirst: db.examSessionFindFirst },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  createNotification: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { GET, PATCH, DELETE } from "../../app/api/attestations/[id]/route";
import { makeRequest } from "../helpers/request";

function makeAttestation(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    userId: "user-1",
    formationId: "formation-1",
    status: "VALIDATED",
    code: "FSA-2026-M09-00001-abcde",
    fullName: "Alice Dupont",
    ...overrides,
  };
}

function callGet() {
  return GET(makeRequest({}), { params: Promise.resolve({ id: "att-1" }) });
}

function callPatch(body: unknown) {
  return PATCH(makeRequest(body, { "x-forwarded-for": "1.2.3.4" }), {
    params: Promise.resolve({ id: "att-1" }),
  });
}

function callDelete() {
  return DELETE(makeRequest({}, { "x-forwarded-for": "1.2.3.4" }), {
    params: Promise.resolve({ id: "att-1" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  deps.getAdminUser.mockResolvedValue(null as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
  db.attestationUpdate.mockResolvedValue(
    makeAttestation({ status: "VALIDATED" }) as never,
  );
  db.attestationDelete.mockResolvedValue(makeAttestation() as never);
  db.examSessionFindFirst.mockResolvedValue(null as never);
});

describe("GET /api/attestations/[id]", () => {
  it("401 si ni utilisateur ni admin", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("404 si attestation introuvable", async () => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    db.attestationFindUnique.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  it("401 si un simple utilisateur demande l'attestation d'un autre", async () => {
    deps.getCurrentUser.mockResolvedValue({ id: "user-9" } as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("200 pour le propriétaire dont l'attestation est validée", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("att-1");
    expect(body.code).toBe("FSA-2026-M09-00001-abcde");
  });

  it("403 si la délibération n'est pas publiée", async () => {
    db.examSessionFindFirst.mockResolvedValue({
      exam: { showResults: false },
    } as never);
    const res = await callGet();
    expect(res.status).toBe(403);
  });

  it("masque le code quand l'attestation n'est pas encore validée (hors admin)", async () => {
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ status: "PENDING" }) as never,
    );
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe("••••-••••-••••");
  });

  it("200 admin sans contrôle de propriété", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(db.examSessionFindFirst).not.toHaveBeenCalled();
  });

  it("500 si la lecture échoue", async () => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    db.attestationFindUnique.mockRejectedValue(new Error("db down") as never);
    const res = await callGet();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/attestations/[id]", () => {
  it("401 si non admin", async () => {
    const res = await callPatch({ status: "VALIDATED" });
    expect(res.status).toBe(401);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("400 si le payload ne respecte pas le schéma", async () => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    const res = await callPatch({ status: "NOPE" });
    expect(res.status).toBe(400);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("400 si la date de fin précède la date de début", async () => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    const res = await callPatch({
      startDate: "2026-02-01",
      endDate: "2026-01-01",
    });
    expect(res.status).toBe(400);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("VALIDE : notifie le candidat et journalise l'audit", async () => {
    deps.getAdminUser.mockResolvedValue({
      id: "admin-1",
      name: "Admin",
    } as never);
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ status: "PENDING" }) as never,
    );
    const res = await callPatch({ status: "VALIDATED" });
    expect(res.status).toBe(200);
    expect(deps.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "ATTESTATION_VALIDATED",
      }),
    );
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTESTATION_VALIDATED",
        resourceId: "att-1",
      }),
    );
  });

  it("crée la formation si elle n'existe pas et rattache son id", async () => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    db.formationFindFirst.mockResolvedValue(null as never);
    db.formationCreate.mockResolvedValue({ id: "formation-new" } as never);
    const res = await callPatch({ formation: "Nouvelle Formation" });
    expect(res.status).toBe(200);
    expect(db.formationCreate).toHaveBeenCalledWith({
      data: { name: "Nouvelle Formation", category: "", skills: [] },
    });
    expect(db.attestationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ formationId: "formation-new" }),
      }),
    );
  });

  it("500 si la mise à jour échoue", async () => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    db.attestationUpdate.mockRejectedValue(new Error("db down") as never);
    const res = await callPatch({ status: "REJECTED" });
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/attestations/[id]", () => {
  it("401 si non admin", async () => {
    const res = await callDelete();
    expect(res.status).toBe(401);
    expect(db.attestationDelete).not.toHaveBeenCalled();
  });

  it("supprime l'attestation et journalise l'audit", async () => {
    deps.getAdminUser.mockResolvedValue({
      id: "admin-1",
      name: "Admin",
    } as never);
    const res = await callDelete();
    expect(res.status).toBe(200);
    expect(db.attestationDelete).toHaveBeenCalledWith({ where: { id: "att-1" } });
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTESTATION_DELETED" }),
    );
  });

  it("500 si la suppression échoue", async () => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    db.attestationDelete.mockRejectedValue(new Error("db down") as never);
    const res = await callDelete();
    expect(res.status).toBe(500);
  });
});
