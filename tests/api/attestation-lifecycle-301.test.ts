/**
 * #301 — Révocation et rétrogradation NON destructives.
 *
 * Contrat vérifié ici :
 *  - REVOKE journalise TOUJOURS (même sans userId) et notifie les historiques
 *    anonymes via les administrateurs ; le statut devient REVOKED avec date ;
 *  - RETROGRADE n'appelle JAMAIS `examSession.deleteMany` : les sessions sont
 *    archivées (statut + date + motif), les réponses sont conservées ;
 *  - RETROGRADE n'invalide pas le sceau ni le PDF ;
 *  - une attestation supprimée logiquement ne peut plus être révoquée ni
 *    rétrogradée (409) ;
 *  - motif obligatoire pour chaque action.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
  sessionUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findUnique: db.attestationFindUnique,
      update: db.attestationUpdate,
    },
    examSession: {
      deleteMany: db.sessionDeleteMany,
      updateMany: db.sessionUpdateMany,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createNotification: vi.fn(),
  notifyAllAdmins: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
  notifyAllAdmins: deps.notifyAllAdmins,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { POST } from "../../app/api/admin/attestations/[id]/actions/route";
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
    sealHash: "b".repeat(64),
    sealedAt: new Date("2026-01-01T00:00:00.000Z"),
    sealVersion: 2,
    deletedAt: null,
    formation: { id: "formation-1", name: "Formation A" },
    ...overrides,
  };
}

function callActions(body: unknown) {
  return POST(makeRequest(body), { params: Promise.resolve({ id: "att-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.notifyAllAdmins.mockResolvedValue([] as never);
  db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
  db.attestationUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    makeAttestation({ ...data }) as never,
  );
  db.sessionUpdateMany.mockResolvedValue({ count: 2 } as never);
});

describe("POST /api/admin/attestations/[id]/actions — #301", () => {
  it("400 sans motif exploitable, 401 sans admin, 404 si inconnue", async () => {
    expect((await callActions({ action: "REVOKE" })).status).toBe(400);
    expect((await callActions({ action: "RETROGRADE", reason: "ab" })).status).toBe(400);
    deps.getAdminUser.mockResolvedValue(null as never);
    expect((await callActions({ action: "REVOKE", reason: "Fraude avérée" })).status).toBe(401);
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    db.attestationFindUnique.mockResolvedValue(null as never);
    expect((await callActions({ action: "REVOKE", reason: "Fraude avérée" })).status).toBe(404);
  });

  it("400 sur une action inconnue", async () => {
    const res = await callActions({ action: "PURGE", reason: "Nettoyage" });
    expect(res.status).toBe(400);
  });

  it("REVOKE → REVOKED + date/auteur/motif, jamais de suppression", async () => {
    const res = await callActions({ action: "REVOKE", reason: "Fraude avérée" });
    expect(res.status).toBe(200);
    const call = db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).toMatchObject({
      status: "REVOKED",
      revokedById: "admin-1",
      revokeReason: "Fraude avérée",
    });
    expect(call.data.revokedAt).toBeInstanceOf(Date);
    expect(call.data).not.toHaveProperty("sealHash");
    expect(db.sessionDeleteMany).not.toHaveBeenCalled();
  });

  it("REVOKE est journalisée même pour un historique anonyme (sans userId)", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation({ userId: null }) as never);
    const res = await callActions({ action: "REVOKE", reason: "Fraude avérée" });
    expect(res.status).toBe(200);
    const auditCalls = deps.createAuditLog.mock.calls.map(([arg]) => arg as Record<string, unknown>);
    expect(auditCalls.some((arg) => arg.action === "ATTESTATION_REVOKED")).toBe(true);
    const revokeLog = auditCalls.find((arg) => arg.action === "ATTESTATION_REVOKED");
    expect(revokeLog?.resource).toBe("ATTESTATION");
    expect(revokeLog?.resourceId).toBe("att-1");
    expect(revokeLog?.newValue).toMatchObject({ reason: "Fraude avérée", adminId: "admin-1" });
    expect(deps.createNotification).not.toHaveBeenCalled();
    expect(deps.notifyAllAdmins).toHaveBeenCalled();
    expect((deps.notifyAllAdmins.mock.calls[0][0] as { message: string }).message).toContain("FSA-2026-M09-00001-abcde");
  });

  it("REVOKE notifie le titulaire quand il existe", async () => {
    await callActions({ action: "REVOKE", reason: "Fraude avérée" });
    expect(deps.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", type: "ATTESTATION_REJECTED" }),
    );
  });

  it("RETROGRADE → sessions ARCHIVÉES, jamais supprimées, réponses conservées", async () => {
    const res = await callActions({ action: "RETROGRADE", reason: "Examen à repasser" });
    expect(res.status).toBe(200);
    expect(db.sessionDeleteMany).not.toHaveBeenCalled();

    const archive = db.sessionUpdateMany.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> };
    expect(archive.where).toEqual({
      OR: [{ id: "session-1" }, { userId: "user-1", exam: { formationId: "formation-1" } }],
    });
    expect(archive.data).toMatchObject({ status: "ARCHIVED", archivedById: "admin-1", archiveReason: "Examen à repasser" });
    expect(archive.data.archivedAt).toBeInstanceOf(Date);
    expect(archive.data).not.toHaveProperty("answers");

    const attestationCall = db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(attestationCall.data).toMatchObject({
      status: "PENDING",
      certificationScore: 0,
      stageScore: 0,
      retrogradedById: "admin-1",
      retrogradeReason: "Examen à repasser",
    });
    expect(attestationCall.data.retrogradedAt).toBeInstanceOf(Date);
    // Le sceau et la preuve PDF ne sont ni réécrits ni invalidés.
    for (const preserved of ["sealHash", "sealedAt", "sealVersion", "pdfKey", "pdfHash", "pdfVersion"]) {
      expect(attestationCall.data).not.toHaveProperty(preserved);
    }
  });

  it("RETROGRADE journalise l'action même sans userId et n'archive aucune session orpheline", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation({ userId: null, sessionId: null }) as never);
    const res = await callActions({ action: "RETROGRADE", reason: "Examen à repasser" });
    expect(res.status).toBe(200);
    expect(db.sessionUpdateMany).not.toHaveBeenCalled();
    const auditCalls = deps.createAuditLog.mock.calls.map(([arg]) => arg as Record<string, unknown>);
    expect(auditCalls.some((arg) => arg.action === "USER_RETROGRADED")).toBe(true);
    const log = auditCalls.find((arg) => arg.action === "USER_RETROGRADED");
    expect(log?.resource).toBe("ATTESTATION");
    expect(log?.resourceId).toBe("att-1");
    expect(log?.newValue).toMatchObject({ reason: "Examen à repasser" });
    expect(deps.notifyAllAdmins).toHaveBeenCalled();
  });

  it("409 si l'attestation est supprimée logiquement", async () => {
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ deletedAt: new Date("2026-09-01T00:00:00.000Z") }) as never,
    );
    const revoke = await callActions({ action: "REVOKE", reason: "Fraude avérée" });
    expect(revoke.status).toBe(409);
    const retro = await callActions({ action: "RETROGRADE", reason: "Examen à repasser" });
    expect(retro.status).toBe(409);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
    expect(db.sessionUpdateMany).not.toHaveBeenCalled();
  });
});
