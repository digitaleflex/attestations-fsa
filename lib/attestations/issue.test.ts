import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
  formationFindFirst: vi.fn(),
  attestationFindFirst: vi.fn(),
  attestationCount: vi.fn(),
  attestationCreate: vi.fn(),
  attestationUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findUnique: mocks.sessionFindUnique },
    formation: { findFirst: mocks.formationFindFirst },
    attestation: {
      findFirst: mocks.attestationFindFirst,
      count: mocks.attestationCount,
      create: mocks.attestationCreate,
      update: mocks.attestationUpdate,
    },
  },
}));

import { issueExamAttestation } from "./issue";
import { verifyCertificateSeal } from "@/lib/crypto/seal";
import { attestationSealPayload } from "@/lib/attestations/proof";

function baseSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    userId: "user-1",
    status: "GRADED",
    type: "OFFICIAL",
    finalScore: 88,
    internshipScore: 90,
    startedAt: new Date("2026-01-01T10:00:00Z"),
    submittedAt: new Date("2026-01-01T11:00:00Z"),
    exam: {
      id: "exam-1",
      type: "OFFICIAL",
      formationId: "formation-1",
      formation: { name: "Formation FSA" },
      passingScore: 65,
    },
    candidate: {
      name: "Alice Candidat",
      email: "alice@example.test",
      gender: "F",
      birthDate: new Date("2000-05-05"),
      birthPlace: "Cotonou",
    },
    ...overrides,
  };
}

const issueOptions = {
  now: new Date("2026-01-02T12:00:00Z"),
  generator: {
    generateCanonicalAttestationPdf: vi
      .fn()
      .mockResolvedValue(Buffer.from("%PDF-1.7\ntest")),
  },
  storage: {
    put: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn().mockResolvedValue(""),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CERT_SEAL_SECRET", "test-certificate-seal-secret-32-chars");
  mocks.attestationCount.mockResolvedValue(0 as never);
  mocks.attestationCreate.mockResolvedValue({} as never);
  mocks.attestationUpdate.mockResolvedValue({} as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("issueExamAttestation", () => {
  it("renvoie une erreur si la session n'existe pas", async () => {
    mocks.sessionFindUnique.mockResolvedValue(null);
    const result = await issueExamAttestation("missing");
    expect(result.created).toBe(false);
    expect(result.error).toBe("Session non trouvée");
    expect(mocks.attestationCreate).not.toHaveBeenCalled();
  });

  it("est idempotent par session : ne recrée pas une attestation existante", async () => {
    mocks.sessionFindUnique.mockResolvedValue(baseSession() as never);
    mocks.attestationFindFirst.mockResolvedValue({
      id: "existing",
      code: "FSA-2026-M01-00001-existing",
      status: "VALIDATED",
      certificationScore: 88,
      stageScore: 90,
      certificationMention: "TRES_BIEN",
    } as never);

    const result = await issueExamAttestation("session-1", issueOptions);

    expect(result.created).toBe(false);
    expect(result.updated).toBeUndefined();
    expect(result.code).toBe("FSA-2026-M01-00001-existing");
    expect(mocks.attestationCreate).not.toHaveBeenCalled();
    expect(mocks.attestationUpdate).not.toHaveBeenCalled();
  });

  it("met à jour score/mention/status lors d'une re-correction à la hausse", async () => {
    mocks.sessionFindUnique.mockResolvedValue(
      baseSession({ finalScore: 95 }) as never,
    );
    mocks.attestationFindFirst.mockResolvedValue({
      id: "existing",
      code: "FSA-2026-M01-00001-existing",
      status: "VALIDATED",
      certificationScore: 88,
      stageScore: 90,
      certificationMention: "TRES_BIEN",
      issuedAt: new Date("2026-01-01T12:00:00Z"),
      pdfVersion: 1,
    } as never);

    const result = await issueExamAttestation("session-1", issueOptions);

    expect(result.updated).toBe(true);
    const arg = mocks.attestationUpdate.mock.calls[0][0] as {
      data: {
        certificationScore: number;
        certificationMention: string;
        status: string;
      };
    };
    expect(arg.data.certificationScore).toBe(95);
    expect(arg.data.certificationMention).toBe("EXCELLENCE");
    expect(arg.data.status).toBe("VALIDATED");
  });

  it("révoque (REJECTED) lors d'une re-correction à la baisse sous le seuil", async () => {
    mocks.sessionFindUnique.mockResolvedValue(
      baseSession({ finalScore: 40 }) as never,
    );
    mocks.attestationFindFirst.mockResolvedValue({
      id: "existing",
      code: "FSA-2026-M01-00001-existing",
      status: "VALIDATED",
      certificationScore: 88,
      stageScore: 90,
      certificationMention: "TRES_BIEN",
      issuedAt: new Date("2026-01-01T12:00:00Z"),
      pdfVersion: 1,
    } as never);

    const result = await issueExamAttestation("session-1", issueOptions);

    expect(result.created).toBe(false);
    expect(result.revoked).toBe(true);
    const arg = mocks.attestationUpdate.mock.calls[0][0] as {
      data: {
        certificationScore: number;
        certificationMention: string;
        status: string;
      };
    };
    expect(arg.data.certificationScore).toBe(40);
    expect(arg.data.certificationMention).toBe("PASSABLE");
    expect(arg.data.status).toBe("REJECTED");
  });

  it("n'émet rien si la session échoue et qu'aucune attestation n'existe", async () => {
    mocks.sessionFindUnique.mockResolvedValue(
      baseSession({ finalScore: 40 }) as never,
    );
    mocks.attestationFindFirst.mockResolvedValue(null as never);

    const result = await issueExamAttestation("session-1");

    expect(result.created).toBe(false);
    expect(mocks.attestationCreate).not.toHaveBeenCalled();
    expect(mocks.attestationUpdate).not.toHaveBeenCalled();
  });

  it("échoue proprement si aucune formation n'est disponible", async () => {
    mocks.sessionFindUnique.mockResolvedValue(
      baseSession({
        exam: { id: "exam-1", formationId: null, passingScore: 65 },
      }) as never,
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

    const result = await issueExamAttestation("session-1", issueOptions);

    expect(result.created).toBe(true);
    expect(result.code).toMatch(/^FSA-2026-M01-00005-[0-9a-f]{5}$/);
    expect(mocks.attestationCreate).toHaveBeenCalledTimes(1);

    const arg = mocks.attestationCreate.mock.calls[0][0] as {
      data: {
        certificationMention: string;
        status: string;
        type: string;
        sessionId: string;
      };
    };
    // finalScore = 88 -> TRES_BIEN sur l'échelle des mentions
    expect(arg.data.certificationMention).toBe("TRES_BIEN");
    expect(arg.data.status).toBe("VALIDATED");
    expect(arg.data.type).toBe("CERTIFICATION");
    expect(arg.data.sessionId).toBe("session-1");
  });

  it("ne throw jamais : capture les erreurs Prisma", async () => {
    mocks.sessionFindUnique.mockRejectedValue(new Error("DB down"));
    const result = await issueExamAttestation("session-1");
    expect(result.created).toBe(false);
    expect(result.error).toBe("DB down");
  });
});

// #258 — preuve officielle : session liée, PDF serveur versionné, sceau v2.
describe("issueExamAttestation — preuve officielle (#258)", () => {
  const SEAL_SECRET = "test-certificate-seal-secret-32-chars";

  it("refuse d'émettre sans session : une CERTIFICATION est toujours liée", async () => {
    const result = await issueExamAttestation("   ");
    expect(result.created).toBe(false);
    expect(result.error).toContain("session");
    expect(mocks.sessionFindUnique).not.toHaveBeenCalled();
    expect(mocks.attestationCreate).not.toHaveBeenCalled();
  });

  it("persiste la preuve PDF (clé versionnée, hash, version, horodatage) et un sceau v2", async () => {
    mocks.sessionFindUnique.mockResolvedValue(baseSession());
    mocks.attestationFindFirst.mockResolvedValue(null);

    const result = await issueExamAttestation("session-1", issueOptions);
    expect(result.created).toBe(true);

    const data = (mocks.attestationCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.pdfKey).toBe(`attestations/${result.code}/v1.pdf`);
    expect(data.pdfHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.pdfVersion).toBe(1);
    expect(data.pdfGeneratedAt).toEqual(issueOptions.now);
    expect(data.sealVersion).toBe(2);
    expect(data.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.sealedAt).toEqual(issueOptions.now);
    // Aucune URL signée n'est persistée : la preuve est la clé + le hash.
    expect(data.pdfUrl).toBeUndefined();
    expect(issueOptions.storage.put).toHaveBeenCalledWith(
      data.pdfKey,
      expect.any(Buffer),
      "application/pdf",
    );
  });

  it("grave dans le PDF l'URL publique de vérification du QR", async () => {
    mocks.sessionFindUnique.mockResolvedValue(baseSession());
    mocks.attestationFindFirst.mockResolvedValue(null);

    const result = await issueExamAttestation("session-1", {
      ...issueOptions,
      appUrl: "https://fsa.example/",
    });

    const input = (issueOptions.generator.generateCanonicalAttestationPdf as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(input.verificationUrl).toBe(`https://fsa.example/verifier?code=${result.code}`);
    expect(input.pdfVersion).toBe(1);
    expect(input.sealVersion).toBe(2);
  });

  it("rescelle en v2 une nouvelle version de PDF sans changer le code (#258)", async () => {
    mocks.sessionFindUnique.mockResolvedValue(baseSession({ finalScore: 95 }));
    mocks.attestationFindFirst.mockResolvedValue({
      id: "existing",
      code: "FSA-2026-M01-00001-abcde",
      status: "VALIDATED",
      certificationScore: 88,
      stageScore: 90,
      certificationMention: "TRES_BIEN",
      issuedAt: new Date("2026-01-01T12:00:00Z"),
      pdfKey: "attestations/FSA-2026-M01-00001-abcde/v1.pdf",
      pdfHash: "a".repeat(64),
      pdfVersion: 1,
      pdfGeneratedAt: new Date("2026-01-01T12:30:00Z"),
    } as never);

    const result = await issueExamAttestation("session-1", issueOptions);

    expect(result.updated).toBe(true);
    expect(result.code).toBe("FSA-2026-M01-00001-abcde");
    const data = (mocks.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.pdfKey).toBe("attestations/FSA-2026-M01-00001-abcde/v2.pdf");
    expect(data.pdfVersion).toBe(2);
    expect(data.sealVersion).toBe(2);
    expect(data.sealHash).not.toBe("a".repeat(64));
    // L'ancien PDF probant reste en base : seule sa clé de lecture change.
    expect(issueOptions.storage.put).toHaveBeenCalledWith(
      "attestations/FSA-2026-M01-00001-abcde/v2.pdf",
      expect.any(Buffer),
      "application/pdf",
    );
  });

  it("révoque sans publier de nouveau PDF (le sceau de révocation reste cohérent)", async () => {
    mocks.sessionFindUnique.mockResolvedValue(baseSession({ finalScore: 40 }));
    mocks.attestationFindFirst.mockResolvedValue({
      id: "existing",
      code: "FSA-2026-M01-00001-abcde",
      status: "VALIDATED",
      certificationScore: 88,
      stageScore: 90,
      certificationMention: "TRES_BIEN",
      issuedAt: new Date("2026-01-01T12:00:00Z"),
      pdfKey: "attestations/FSA-2026-M01-00001-abcde/v1.pdf",
      pdfHash: "a".repeat(64),
      pdfVersion: 1,
      pdfGeneratedAt: new Date("2026-01-01T12:30:00Z"),
    } as never);

    const result = await issueExamAttestation("session-1", issueOptions);

    expect(result.revoked).toBe(true);
    const data = (mocks.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("REJECTED");
    expect(data.pdfVersion).toBe(1);
    expect(data.sealVersion).toBe(2);
    expect(issueOptions.storage.put).not.toHaveBeenCalled();
  });

  it("le sceau émis se revérifie avec la clé de production du test", async () => {
    mocks.sessionFindUnique.mockResolvedValue(baseSession());
    mocks.attestationFindFirst.mockResolvedValue(null);

    await issueExamAttestation("session-1", issueOptions);

    const data = (mocks.attestationCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    const verification = verifyCertificateSeal(
      attestationSealPayload({
        ...data,
        // `issuedAt` est un default Prisma : on le restitue pour reconstruire
        // exactement l'instant couvert par le sceau.
        issuedAt: issueOptions.now,
        formation: { name: "Formation FSA" },
        sealHash: data.sealHash as string,
      } as never),
      SEAL_SECRET,
    );
    expect(verification.valid).toBe(true);
    expect(verification.sealVersion).toBe(2);
  });

  it("n'émet rien si le générateur PDF serveur est indisponible", async () => {
    mocks.sessionFindUnique.mockResolvedValue(baseSession());
    mocks.attestationFindFirst.mockResolvedValue(null);

    const result = await issueExamAttestation("session-1", {
      ...issueOptions,
      generator: {
        generateCanonicalAttestationPdf: vi.fn(async () => Buffer.from("pas un pdf")),
      },
    });

    expect(result.created).toBe(false);
    expect(result.error).toContain("PDF");
    expect(mocks.attestationCreate).not.toHaveBeenCalled();
  });
});
