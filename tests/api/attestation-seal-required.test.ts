/**
 * #288 — Le scellement est obligatoire sur TOUTES les voies d'émission.
 *
 * La garde existe sur le hub des certifications
 * (`lib/attestations/issue.ts:150-153`, reinforced `:204`/`:264`) et sur le
 * rescellement (`lib/attestations/proof.ts:52`). Deux voies la contournaient en
 * écrivant `...(seal ? {...} : {})` : la ligne était créée NON SCELLÉE, en
 * silence, si `CERT_SEAL_SECRET` était absente.
 *
 * Contrat vérifié ici :
 *  - sans clé, `POST /api/attestations` ne crée AUCUNE ligne (prisma `create`
 *    jamais appelé) et renvoie une erreur explicite (503) ;
 *  - sans clé, `issueStageAttestation` lève une erreur explicite, n'écrit
 *    aucune attestation et n'archIVE PAS la demande (jeton `ACCEPTED` intact) ;
 *  - avec clé, le comportement est préservé : création + `sealHash` /
 *    `sealedAt` / `sealVersion` écrits (non-régression) ;
 *  - une assertion statique interdit la réapparition du motif
 *    `...(seal ? {` dans les deux fichiers.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const SECRET = "seal-required-test-secret-0123456789abcdef";

const db = vi.hoisted(() => ({
  formationFindFirst: vi.fn(),
  formationCreate: vi.fn(),
  attestationCount: vi.fn(),
  attestationCreate: vi.fn(),
  attestationFindFirst: vi.fn(),
  internshipFindUnique: vi.fn(),
  internshipUpdateMany: vi.fn(),
  settingsFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  // La voie stage passe par une transaction sérialisable : le client
  // transactionnel reçoit les mêmes mocks.
  const client = {
    $queryRaw: async () => [{ nextval: BigInt(1) }],
    formation: { findFirst: db.formationFindFirst, create: db.formationCreate },
    attestation: {
      count: db.attestationCount,
      create: db.attestationCreate,
      findFirst: db.attestationFindFirst,
    },
    internshipRequest: {
      findUnique: db.internshipFindUnique,
      updateMany: db.internshipUpdateMany,
    },
    settings: { findFirst: db.settingsFindFirst },
  };
  return { prisma: { ...client, $transaction: (fn: (tx: unknown) => unknown) => fn(client) } };
});

const deps = vi.hoisted(() => ({ getAdminUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { POST } from "../../app/api/attestations/route";
import { issueStageAttestation, clearStageAttestationInFlightForTests } from "../../lib/stage-attestation/issue";

function callCreateAttestation(body: unknown) {
  const request = new Request("http://localhost/api/attestations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

const STAGE_BODY = {
  fullName: "Alice Doe",
  birthDate: "2000-01-01",
  birthPlace: "Cotonou",
  formation: "Pisciculture",
  startDate: "2026-01-01",
  endDate: "2026-06-01",
  location: "Cotonou",
  instructor: "M. X",
  issuingCompany: "FSA",
  type: "STAGE",
  stageScore: 15,
};

const stageInput = { startDate: "2026-01-01", endDate: "2026-06-01", stageScore: 15 };

function callStageIssue() {
  return issueStageAttestation({ internshipRequestId: "intern-1", body: stageInput });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CERT_SEAL_SECRET;
  clearStageAttestationInFlightForTests();

  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.formationFindFirst.mockResolvedValue({ id: "formation-1", name: "Stage" } as never);
  db.formationCreate.mockResolvedValue({ id: "formation-1", name: "Stage" } as never);
  db.attestationCount.mockResolvedValue(0);
  db.attestationFindFirst.mockResolvedValue(null as never);
  db.attestationCreate.mockResolvedValue({ id: "att-1", code: "FSA-2026-M09-00001-abcde" } as never);
  db.settingsFindFirst.mockResolvedValue({
    institutionName: "FSA",
    location: "Abomey-Calavi",
    instructorName: "Directeur Technique",
  } as never);
  db.internshipFindUnique.mockResolvedValue({
    id: "intern-1",
    userId: "user-1",
    fullName: "Alice DOSSOU",
    position: "Pisciculture",
    status: "ACCEPTED",
    createdAt: new Date("2025-12-01T00:00:00.000Z"),
    user: {
      id: "user-1",
      birthDate: new Date("2000-01-01T00:00:00.000Z"),
      birthPlace: "Cotonou",
    },
  } as never);
  db.internshipUpdateMany.mockResolvedValue({ count: 1 } as never);
});

afterEach(() => {
  delete process.env.CERT_SEAL_SECRET;
  vi.unstubAllEnvs();
});

describe("#288 POST /api/attestations — le sceau est obligatoire", () => {
  it("sans clé : aucune ligne créée et erreur explicite", async () => {
    const res = await callCreateAttestation(STAGE_BODY);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      message: expect.stringContaining("clé de scellement indisponible"),
    });
    expect(db.attestationCreate).not.toHaveBeenCalled();
  });

  it("sans clé : refus AVANT toute écriture (pas même de formation créée)", async () => {
    db.formationFindFirst.mockResolvedValue(null as never);
    const res = await callCreateAttestation(STAGE_BODY);

    expect(res.status).toBe(503);
    expect(db.formationCreate).not.toHaveBeenCalled();
    expect(db.attestationCount).not.toHaveBeenCalled();
    expect(db.attestationCreate).not.toHaveBeenCalled();
  });

  it("clé trop courte : refusée comme absente", async () => {
    process.env.CERT_SEAL_SECRET = "court";
    const res = await callCreateAttestation(STAGE_BODY);

    expect(res.status).toBe(503);
    expect(db.attestationCreate).not.toHaveBeenCalled();
  });

  it("prod sans clé : refus + journalisation de l'incident", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await callCreateAttestation(STAGE_BODY);

    expect(res.status).toBe(503);
    expect(db.attestationCreate).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("scellement désactivé"),
    );
  });

  it("avec clé : comportement préservé (création + sceau écrit)", async () => {
    process.env.CERT_SEAL_SECRET = SECRET;
    const res = await callCreateAttestation(STAGE_BODY);

    expect(res.status).toBe(201);
    const createArgs = db.attestationCreate.mock.calls[0][0] as {
      data: { sealHash?: string; sealedAt?: Date; sealVersion?: number };
    };
    expect(createArgs.data.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createArgs.data.sealedAt).toBeInstanceOf(Date);
    expect(createArgs.data.sealVersion).toBe(1);
  });
});

describe("#288 issueStageAttestation — le sceau est obligatoire", () => {
  it("sans clé : erreur explicite, aucune attestation, demande non archivée", async () => {
    await expect(callStageIssue()).rejects.toMatchObject({
      status: 503,
      code: "CONFIGURATION_MISSING",
      message: expect.stringContaining("clé de scellement indisponible"),
    });
    expect(db.attestationCreate).not.toHaveBeenCalled();
    // Le jeton d'émission (`ACCEPTED` -> `ARCHIVED`) reste intact : la demande
    // peut être réémise une fois la clé configurée.
    expect(db.internshipUpdateMany).not.toHaveBeenCalled();
  });

  it("clé trop courte : refusée comme absente", async () => {
    process.env.CERT_SEAL_SECRET = "court";
    await expect(callStageIssue()).rejects.toMatchObject({ status: 503 });
    expect(db.attestationCreate).not.toHaveBeenCalled();
  });

  it("prod sans clé : refus + journalisation de l'incident", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(callStageIssue()).rejects.toMatchObject({ status: 503 });

    expect(db.attestationCreate).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("scellement désactivé"),
    );
  });

  it("avec clé : comportement préservé (création + sceau + sealVersion écrits)", async () => {
    process.env.CERT_SEAL_SECRET = SECRET;

    const outcome = await callStageIssue();

    expect(outcome).toMatchObject({ ok: true, attestation: { id: "att-1" } });
    const createArgs = db.attestationCreate.mock.calls[0][0] as {
      data: { sealHash?: string; sealedAt?: Date; sealVersion?: number; type?: string };
    };
    expect(createArgs.data.type).toBe("STAGE");
    expect(createArgs.data.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createArgs.data.sealedAt).toBeInstanceOf(Date);
    expect(createArgs.data.sealVersion).toBe(1);
    expect(db.internshipUpdateMany).toHaveBeenCalledTimes(1);
  });
});

describe("#288 garde statique — le motif conditionnel ne doit pas revenir", () => {
  const files = [
    "app/api/attestations/route.ts",
    "lib/stage-attestation/issue.ts",
  ];

  for (const file of files) {
    it(`${file} : aucune écriture conditionnelle du sceau`, () => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/\.\.\.\(seal\s*\?\s*\{/);
      // La garde duco est bien présente, avec son journalisation en production.
      expect(source).toMatch(/getSealSecret\(\)/);
      expect(source).toMatch(/reportSealDisabledIfProduction\(\)/);
      expect(source).toMatch(/clé de scellement indisponible/);
    });
  }
});
