import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
  formationFindFirst: vi.fn(),
  attestationFindFirst: vi.fn(),
  attestationUpdate: vi.fn(),
  attestationCount: vi.fn(),
  attestationCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findUnique: db.sessionFindUnique },
    formation: { findFirst: db.formationFindFirst },
    attestation: {
      findFirst: db.attestationFindFirst,
      update: db.attestationUpdate,
      count: db.attestationCount,
      create: db.attestationCreate,
    },
  },
}));

import { issueExamAttestation } from "../../../lib/attestations/issue";

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    userId: "user-1",
    finalScore: 80,
    internshipScore: 15,
    startedAt: new Date("2026-09-01T09:00:00Z"),
    submittedAt: new Date("2026-09-01T10:00:00Z"),
    exam: {
      id: "exam-1",
      formationId: "formation-1",
      passingScore: 65,
    },
    candidate: {
      id: "user-1",
      name: "Alice",
      birthDate: new Date("2000-01-01"),
      birthPlace: "Cotonou",
    },
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CERT_SEAL_SECRET = "issue-test-secret-0123456789abcdef";
  db.attestationFindFirst.mockResolvedValue(null as never);
  db.attestationCount.mockResolvedValue(3 as never);
  db.attestationCreate.mockResolvedValue({ id: "att-1" } as never);
  db.attestationUpdate.mockResolvedValue({ id: "att-1" } as never);
});

describe("issueExamAttestation (#133)", () => {
  it("session introuvable → erreur, rien créé", async () => {
    db.sessionFindUnique.mockResolvedValue(null as never);
    const res = await issueExamAttestation("session-1");
    expect(res.created).toBe(false);
    expect(res.error).toContain("Session non trouvée");
    expect(db.attestationCreate).not.toHaveBeenCalled();
  });

  it("aucune formation → erreur", async () => {
    db.sessionFindUnique.mockResolvedValue(
      makeSession({
        exam: { id: "exam-1", formationId: null, passingScore: 65 },
      }),
    );
    db.formationFindFirst.mockResolvedValue(null as never);
    const res = await issueExamAttestation("session-1");
    expect(res.created).toBe(false);
    expect(res.error).toContain("Aucune formation");
  });

  it("réussite + pas d'existante → crée avec code FSA-YYYY-MM-XXXXX-hash", async () => {
    db.sessionFindUnique.mockResolvedValue(makeSession());
    const res = await issueExamAttestation("session-1");
    expect(res.created).toBe(true);
    expect(res.code).toMatch(/^FSA-2026-M09-\d{5}-[0-9a-f]{5}$/);
    expect(db.attestationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          sessionId: "session-1",
          type: "CERTIFICATION",
          status: "VALIDATED",
          certificationScore: 80,
          stageScore: 15,
          certificationMention: "TRES_BIEN",
        }),
      }),
    );
  });

  it("scelle l'attestation créée (sealHash + sealedAt) (#155)", async () => {
    db.sessionFindUnique.mockResolvedValue(makeSession());
    const res = await issueExamAttestation("session-1");
    expect(res.created).toBe(true);

    const createArgs = db.attestationCreate.mock.calls[0][0] as {
      data: { sealHash?: string; sealedAt?: Date };
    };
    expect(createArgs.data.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createArgs.data.sealedAt).toBeInstanceOf(Date);
  });

  it("ne scelle pas si la clé est absente (dégradé, non bloquant) (#155)", async () => {
    delete process.env.CERT_SEAL_SECRET;
    db.sessionFindUnique.mockResolvedValue(makeSession());
    const res = await issueExamAttestation("session-1");
    expect(res.created).toBe(true);

    const createArgs = db.attestationCreate.mock.calls[0][0] as {
      data: { sealHash?: string };
    };
    expect(createArgs.data.sealHash).toBeUndefined();
  });

  it("échec + pas d'existante → rien à émettre", async () => {
    db.sessionFindUnique.mockResolvedValue(makeSession({ finalScore: 50 }));
    const res = await issueExamAttestation("session-1");
    expect(res.created).toBe(false);
    expect(db.attestationCreate).not.toHaveBeenCalled();
  });

  it("existante + réussite → mise à jour (idempotence, pas de doublon)", async () => {
    db.sessionFindUnique.mockResolvedValue(makeSession());
    db.attestationFindFirst.mockResolvedValue({
      id: "att-1",
      status: "VALIDATED",
    } as never);
    const res = await issueExamAttestation("session-1");
    expect(res.created).toBe(false);
    expect(res.updated).toBe(true);
    expect(db.attestationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att-1" },
        data: expect.objectContaining({
          certificationScore: 80,
          certificationMention: "TRES_BIEN",
          status: "VALIDATED",
        }),
      }),
    );
    expect(db.attestationCreate).not.toHaveBeenCalled();
  });

  it("re-scelle une attestation mise à jour (#155)", async () => {
    db.sessionFindUnique.mockResolvedValue(makeSession());
    db.attestationFindFirst.mockResolvedValue({
      id: "att-1",
      status: "VALIDATED",
      code: "FSA-2026-M09-00001-abcde",
    } as never);

    await issueExamAttestation("session-1");

    const updateArgs = db.attestationUpdate.mock.calls[0][0] as {
      data: { sealHash?: string; sealedAt?: Date };
    };
    expect(updateArgs.data.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(updateArgs.data.sealedAt).toBeInstanceOf(Date);
  });

  it("existante + re-correction à la baisse → révocation (REJECTED)", async () => {
    db.sessionFindUnique.mockResolvedValue(makeSession({ finalScore: 40 }));
    db.attestationFindFirst.mockResolvedValue({
      id: "att-1",
      status: "VALIDATED",
    } as never);
    const res = await issueExamAttestation("session-1");
    expect(res.created).toBe(false);
    expect(res.revoked).toBe(true);
    expect(db.attestationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED" }),
      }),
    );
  });

  it("ne throw jamais (erreur interne → objet erreur)", async () => {
    db.sessionFindUnique.mockRejectedValue(new Error("DB down"));
    const res = await issueExamAttestation("session-1");
    expect(res.created).toBe(false);
    expect(res.error).toContain("DB down");
  });
});
