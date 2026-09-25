import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCertificateSeal } from "@/lib/crypto/seal";
import { attestationSealPayload } from "@/lib/attestations/proof";
import { officialPdfDownloadPath } from "@/lib/attestations/verification-url";

/**
 * Rescellement des mutations autorisées sur une attestation officielle (#258).
 *
 * Toute mutation de cycle de vie d'une CERTIFICATION liée à une session doit
 * produire un nouveau sceau v2 ; un rejet ne republie pas de PDF. Les ~40
 * attestations historiques (sans session, sans PDF) restent hors de ce
 * périmètre : elles ne sont ni migrées ni réémises.
 */

const SEAL_SECRET = "reseal-test-secret-0123456789abcdef";
const CODE = "FSA-2026-M09-00007-abcde";

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
  formationFindFirst: vi.fn(),
  createNotification: vi.fn(),
  createAuditLog: vi.fn(),
  getAdminUser: vi.fn(),
  getCurrentUser: vi.fn(),
  generateOfficialPdf: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: { findUnique: db.attestationFindUnique, update: db.attestationUpdate },
    formation: { findFirst: db.formationFindFirst },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: db.getCurrentUser,
  getAdminUser: db.getAdminUser,
}));
vi.mock("@/lib/notifications", () => ({ createNotification: db.createNotification }));
vi.mock("@/lib/audit", () => ({ createAuditLog: db.createAuditLog }));

// Le générateur et le stockage sont injectés : aucun bucket réel n'est touché.
vi.mock("@/lib/attestations/pdf", () => ({
  generateOfficialPdf: db.generateOfficialPdf,
  OfficialPdfUnavailableError: class OfficialPdfUnavailableError extends Error {},
}));

import { PATCH } from "../../app/api/attestations/[id]/route";
import { POST as claim } from "../../app/api/user/attestations/[id]/claim/route";
import { makeRequest } from "../helpers/request";

const proof = {
  pdfKey: `attestations/${CODE}/v2.pdf`,
  pdfHash: "b".repeat(64),
  pdfVersion: 2,
  pdfGeneratedAt: new Date("2026-09-25T12:00:00Z"),
};

function official(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    userId: "user-1",
    type: "CERTIFICATION",
    status: "VALIDATED",
    sessionId: "session-1",
    code: CODE,
    fullName: "Alice Dupont",
    email: "alice@example.test",
    gender: "F",
    birthDate: new Date("2000-05-05"),
    birthPlace: "Cotonou",
    formationId: "formation-1",
    formation: { name: "Pisciculture" },
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-09-20T00:00:00Z"),
    issuedAt: new Date("2026-09-20T00:00:00Z"),
    location: "En ligne (Plateforme FSA)",
    instructor: "Direction Technique FSA",
    issuingCompany: "FSA",
    certificationScore: 88,
    certificationMention: "TRES_BIEN",
    stageScore: 90,
    pdfKey: `attestations/${CODE}/v1.pdf`,
    pdfHash: "a".repeat(64),
    pdfVersion: 1,
    pdfGeneratedAt: new Date("2026-09-20T01:00:00Z"),
    ...overrides,
  };
}

function callPatch(body: unknown) {
  return PATCH(makeRequest(body), { params: Promise.resolve({ id: "att-1" }) });
}

function callClaim() {
  return claim(makeRequest({}), { params: Promise.resolve({ id: "att-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CERT_SEAL_SECRET = SEAL_SECRET;
  db.getAdminUser.mockResolvedValue({ id: "admin-1", name: "Admin" } as never);
  db.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  db.createNotification.mockResolvedValue(undefined as never);
  db.createAuditLog.mockResolvedValue(undefined as never);
  db.attestationUpdate.mockResolvedValue({} as never);
  db.generateOfficialPdf.mockResolvedValue(proof);
});

afterEach(() => {
  delete process.env.CERT_SEAL_SECRET;
});

describe("PATCH /api/attestations/[id] — reseal d'une CERTIFICATION liée (#258)", () => {
  it("refuse toute mutation à un non-administrateur", async () => {
    db.getAdminUser.mockResolvedValue(null as never);
    const res = await callPatch({ status: "REJECTED" });
    expect(res.status).toBe(401);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("régénère un PDF serveur versionné et rescelle en v2", async () => {
    db.attestationFindUnique.mockResolvedValue(official() as never);

    const res = await callPatch({ fullName: "Alice DUPONT" });
    expect(res.status).toBe(200);

    expect(db.generateOfficialPdf).toHaveBeenCalledWith(
      expect.objectContaining({ code: CODE, sealVersion: 2 }),
      1,
    );

    const data = (db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.pdfKey).toBe(proof.pdfKey);
    expect(data.pdfHash).toBe(proof.pdfHash);
    expect(data.pdfVersion).toBe(2);
    expect(data.sealVersion).toBe(2);
    expect(data.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.pdfUrl).toBeNull();
  });

  it("le sceau produit couvre la correction (et invalide l'ancien)", async () => {
    db.attestationFindUnique.mockResolvedValue(official() as never);

    await callPatch({ fullName: "Alice DUPONT" });

    const data = (db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    const payload = attestationSealPayload({
      ...official(),
      ...data,
      sealHash: data.sealHash as string,
    } as never);

    expect(verifyCertificateSeal(payload, SEAL_SECRET).valid).toBe(true);
    // L'empreinte d'origine ne vaut plus pour les données corrigées.
    expect(
      verifyCertificateSeal(
        attestationSealPayload({ ...official(), fullName: "Alice DUPONT" } as never),
        SEAL_SECRET,
      ).valid,
    ).toBe(false);
  });

  it("un rejet ne republie pas de PDF : le statut et le sceau suffisent", async () => {
    db.attestationFindUnique.mockResolvedValue(official() as never);

    const res = await callPatch({ status: "REJECTED" });
    expect(res.status).toBe(200);
    expect(db.generateOfficialPdf).not.toHaveBeenCalled();

    const data = (db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("REJECTED");
    expect(data.pdfKey).toBe(`attestations/${CODE}/v1.pdf`);
    expect(data.pdfVersion).toBe(1);
    expect(data.sealVersion).toBe(2);
  });

  it("503 et aucune écriture si le PDF serveur probant est indisponible", async () => {
    db.attestationFindUnique.mockResolvedValue(official() as never);
    const { OfficialPdfUnavailableError } = await import("@/lib/attestations/pdf");
    db.generateOfficialPdf.mockRejectedValue(
      new OfficialPdfUnavailableError("générateur absent"),
    );

    const res = await callPatch({ fullName: "Alice DUPONT" });
    expect(res.status).toBe(503);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("ne touche pas aux attestations historiques sans session (les ~40)", async () => {
    db.attestationFindUnique.mockResolvedValue(
      official({ type: "CERTIFICATION", sessionId: null, sealVersion: 1, sealHash: "f".repeat(64) }) as never,
    );

    const res = await callPatch({ fullName: "Alice DUPONT" });
    expect(res.status).toBe(200);
    expect(db.generateOfficialPdf).not.toHaveBeenCalled();

    const data = (db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    // Le sceau historique (v1) n'est ni réécrit ni promu en v2.
    expect(data.sealHash).toBeUndefined();
    expect(data.sealVersion).toBeUndefined();
  });
});

describe("POST /api/user/attestations/[id]/claim — reseal du téléchargement (#258)", () => {
  it("rescelle en v2 le passage VALIDATED → CLAIMED d'une certification liée", async () => {
    db.attestationFindUnique.mockResolvedValue(official() as never);

    const res = await callClaim();
    expect(res.status).toBe(200);

    const data = (db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("CLAIMED");
    expect(data.sealVersion).toBe(2);
    expect(data.sealHash).toMatch(/^[0-9a-f]{64}$/);

    const payload = attestationSealPayload({
      ...official(),
      ...data,
      sealHash: data.sealHash as string,
    } as never);
    expect(verifyCertificateSeal(payload, SEAL_SECRET).valid).toBe(true);
  });

  it("ne rescelle pas un document historique sans session", async () => {
    db.attestationFindUnique.mockResolvedValue(official({ sessionId: null }) as never);

    await callClaim();

    const data = (db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data).toEqual({ status: "CLAIMED" });
  });

  it("le document reste téléchargeable par le lien public après réclamation", async () => {
    db.attestationFindUnique.mockResolvedValue(official() as never);
    await callClaim();
    const data = (db.attestationUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("CLAIMED");
    expect(officialPdfDownloadPath(CODE)).toBe(`/api/verifier/pdf?code=${encodeURIComponent(CODE)}`);
  });
});
