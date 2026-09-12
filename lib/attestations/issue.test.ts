import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
  formationFindFirst: vi.fn(),
  attestationFindFirst: vi.fn(),
  attestationCount: vi.fn(),
  attestationCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findUnique: mocks.sessionFindUnique },
    formation: { findFirst: mocks.formationFindFirst },
    attestation: {
      findFirst: mocks.attestationFindFirst,
      count: mocks.attestationCount,
      create: mocks.attestationCreate,
    },
  },
}));

import { issueExamAttestation } from "./issue";

function baseSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    userId: "user-1",
    finalScore: 88,
    internshipScore: 90,
    startedAt: new Date("2026-01-01T10:00:00Z"),
    submittedAt: new Date("2026-01-01T11:00:00Z"),
    exam: { id: "exam-1", formationId: "formation-1" },
    candidate: {
      name: "Alice Candidat",
      birthDate: new Date("2000-05-05"),
      birthPlace: "Cotonou",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.attestationCount.mockResolvedValue(0 as never);
  mocks.attestationCreate.mockResolvedValue({} as never);
});

describe("issueExamAttestation", () => {
  it("renvoie une erreur si la session n'existe pas", async () => {
    mocks.sessionFindUnique.mockResolvedValue(null);
    const result = await issueExamAttestation("missing");
    expect(result.created).toBe(false);
    expect(result.error).toBe("Session non trouvée");
    expect(mocks.attestationCreate).not.toHaveBeenCalled();
  });

  it("est idempotent : ne recrée pas une attestation existante", async () => {
    mocks.sessionFindUnique.mockResolvedValue(baseSession() as never);
    mocks.attestationFindFirst.mockResolvedValue({ id: "existing" } as never);

    const result = await issueExamAttestation("session-1");

    expect(result.created).toBe(false);
    expect(mocks.attestationCreate).not.toHaveBeenCalled();
  });

  it("échoue proprement si aucune formation n'est disponible", async () => {
    mocks.sessionFindUnique.mockResolvedValue(
      baseSession({ exam: { id: "exam-1", formationId: null } }) as never,
    );
    mocks.formationFindFirst.mockResolvedValue(null as never);

    const result = await issueExamAttestation("session-1");

    expect(result.created).toBe(false);
    expect(result.error).toContain("Aucune formation");
    expect(mocks.attestationCreate).not.toHaveBeenCalled();
  });

  it("crée l'attestation avec un code au bon format et la mention calculée", async () => {
    mocks.sessionFindUnique.mockResolvedValue(baseSession());
    mocks.attestationFindFirst.mockResolvedValue(null as never);
    mocks.attestationCount.mockResolvedValue(4 as never);

    const result = await issueExamAttestation("session-1");

    expect(result.created).toBe(true);
    expect(result.code).toMatch(/^FSA-\d{4}-M\d{2}-00005-[0-9a-f]{5}$/);
    expect(mocks.attestationCreate).toHaveBeenCalledTimes(1);

    const arg = mocks.attestationCreate.mock.calls[0][0] as {
      data: { certificationMention: string; status: string; type: string };
    };
    // finalScore = 88 -> TRES_BIEN sur l'échelle des mentions
    expect(arg.data.certificationMention).toBe("TRES_BIEN");
    expect(arg.data.status).toBe("VALIDATED");
    expect(arg.data.type).toBe("CERTIFICATION");
  });

  it("ne throw jamais : capture les erreurs Prisma", async () => {
    mocks.sessionFindUnique.mockRejectedValue(new Error("DB down"));
    const result = await issueExamAttestation("session-1");
    expect(result.created).toBe(false);
    expect(result.error).toBe("DB down");
  });
});
