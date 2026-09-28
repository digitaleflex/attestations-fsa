/**
 * #299 — La route DELETE ne doit plus supprimer physiquement une attestation.
 *
 * Contrat vérifié ici :
 *  - un motif est obligatoire (400 sinon) ;
 *  - la suppression physique est refusée (409) et jamais appelée ;
 *  - une attestation VALIDATED/CLAIMED est soft-deletée ET publiquement révoquée
 *    avec date, tout en conservant PDF, hash et sceau ;
 *  - l'audit est écrit (soft-delete + révocation) ;
 *  - un historique anonyme (sans userId) est notifié côté administrateurs ;
 *  - une attestation déjà supprimée logiquement est refusée (409).
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
  attestationDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findUnique: db.attestationFindUnique,
      update: db.attestationUpdate,
      delete: db.attestationDelete,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  getCurrentUser: vi.fn(),
  createNotification: vi.fn(),
  notifyAllAdmins: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser, getCurrentUser: deps.getCurrentUser }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
  notifyAllAdmins: deps.notifyAllAdmins,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { DELETE } from "../../app/api/attestations/[id]/route";
import { makeRequest } from "../helpers/request";

function makeAttestation(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    code: "FSA-2026-M09-00001-abcde",
    userId: "user-1",
    sessionId: "session-1",
    formationId: "formation-1",
    status: "VALIDATED",
    type: "CERTIFICATION",
    pdfKey: "attestations/att-1.pdf",
    pdfHash: "a".repeat(64),
    pdfVersion: 1,
    pdfGeneratedAt: new Date("2026-01-01T00:00:00.000Z"),
    sealHash: "b".repeat(64),
    sealedAt: new Date("2026-01-01T00:00:00.000Z"),
    sealVersion: 2,
    deletedAt: null,
    revokedAt: null,
    formation: { name: "Formation A" },
    ...overrides,
  };
}

function callDelete(body: unknown) {
  return DELETE(makeRequest(body), { params: Promise.resolve({ id: "att-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1", name: "Admin" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.notifyAllAdmins.mockResolvedValue([] as never);
  db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
  db.attestationUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    makeAttestation({ ...data }) as never,
  );
});

describe("DELETE /api/attestations/[id] — #299", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callDelete({ reason: "Erreur de saisie" });
    expect(res.status).toBe(401);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("404 si attestation introuvable", async () => {
    db.attestationFindUnique.mockResolvedValue(null as never);
    const res = await callDelete({ reason: "Erreur de saisie" });
    expect(res.status).toBe(404);
  });

  it("400 si le motif obligatoire est absent ou trop court", async () => {
    const missing = await callDelete({});
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ code: "MOTIF_REQUIS" });

    const noBody = await callDelete(undefined);
    expect(noBody.status).toBe(400);
    expect(await noBody.json()).toMatchObject({ code: "MOTIF_REQUIS" });

    const tooShort = await callDelete({ reason: "abc" });
    expect(tooShort.status).toBe(400);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("409 — la suppression physique est refusée, y compris sur une VALIDATED", async () => {
    const res = await callDelete({ reason: "Nettoyage", purge: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "ATTESTATION_PHYSICAL_DELETE_REFUSED" });
    expect(db.attestationDelete).not.toHaveBeenCalled();
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("VALDATED → soft-delete + révocation publique datée, sans toucher au PDF/sceau", async () => {
    const res = await callDelete({ reason: "Erreur de saisie" });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toMatchObject({ softDeleted: true, revoked: true, physicalDelete: false });
    // La réponse est sérialisée en JSON : les dates sont des chaînes ISO.
    expect(typeof payload.attestation.deletedAt).toBe("string");
    expect(Number.isNaN(Date.parse(payload.attestation.deletedAt))).toBe(false);
    expect(typeof payload.attestation.revokedAt).toBe("string");
    expect(Number.isNaN(Date.parse(payload.attestation.revokedAt))).toBe(false);
    expect(payload.attestation.status).toBe("REVOKED");

    const call = db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).toMatchObject({
      status: "REVOKED",
      deletedById: "admin-1",
      deleteReason: "Erreur de saisie",
      revokedById: "admin-1",
      revokeReason: "Erreur de saisie",
    });
    for (const preserved of ["pdfKey", "pdfHash", "pdfVersion", "pdfGeneratedAt", "sealHash", "sealedAt", "sealVersion", "code"]) {
      expect(call.data).not.toHaveProperty(preserved);
    }
    expect(db.attestationDelete).not.toHaveBeenCalled();
  });

  it("CLAIMED → refus de suppression physique, révocation et conservation de la preuve", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation({ status: "CLAIMED" }) as never);
    const res = await callDelete({ reason: "Pseudonyme non autorisé" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ softDeleted: true, revoked: true });
    const call = db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).toMatchObject({ status: "REVOKED" });
    expect(call.data).not.toHaveProperty("sealHash");
    expect(db.attestationDelete).not.toHaveBeenCalled();
  });

  it("PENDING → soft-delete sans révocation", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation({ status: "PENDING", type: "FORMATION" }) as never);
    const res = await callDelete({ reason: "Doublon de saisie" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ softDeleted: true, revoked: false });
    const call = db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty("status");
    expect(call.data).not.toHaveProperty("revokedAt");
  });

  it("409 si l'attestation est déjà supprimée logiquement", async () => {
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ deletedAt: new Date("2026-09-01T00:00:00.000Z") }) as never,
    );
    const res = await callDelete({ reason: "Doublon de saisie" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "ATTESTATION_ALREADY_SOFT_DELETED" });
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("journalise l'audit (soft-delete + révocation) et notifie le titulaire", async () => {
    await callDelete({ reason: "Erreur de saisie" });
    const actions = deps.createAuditLog.mock.calls.map(([arg]) => (arg as { action: string }).action);
    expect(actions).toContain("ATTESTATION_DELETED");
    expect(actions).toContain("ATTESTATION_REVOKED");
    const deleteLog = deps.createAuditLog.mock.calls
      .map(([arg]) => arg as Record<string, unknown>)
      .find((arg) => arg.action === "ATTESTATION_DELETED");
    expect(deleteLog?.newValue).toMatchObject({ reason: "Erreur de saisie", adminId: "admin-1", softDelete: true });
    expect(deps.createNotification).toHaveBeenCalled();
  });

  it("notifie aussi les historiques anonymes (sans userId)", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation({ userId: null }) as never);
    const res = await callDelete({ reason: "Erreur de saisie" });
    expect(res.status).toBe(200);
    expect(deps.createNotification).not.toHaveBeenCalled();
    expect(deps.notifyAllAdmins).toHaveBeenCalled();
    const adminsCall = deps.notifyAllAdmins.mock.calls[0][0] as { title: string; message: string };
    expect(adminsCall.message).toContain("FSA-2026-M09-00001-abcde");
    expect(deps.createAuditLog).toHaveBeenCalled();
  });

  it("500 si l'écriture échoue", async () => {
    db.attestationUpdate.mockRejectedValue(new Error("db down") as never);
    const res = await callDelete({ reason: "Erreur de saisie" });
    expect(res.status).toBe(500);
  });
});
