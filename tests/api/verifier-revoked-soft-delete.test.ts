// tests/api/verifier-revoked-soft-delete.test.ts
// #299/#301 — le cycle de vie non destructif a ajouté le statut `REVOKED`
// (colonnes `revokedAt` / `revokedById` / `revokeReason`) et la suppression
// LOGIQUE (`deletedAt` / `deletedById` / `deleteReason`).
//
// Avant : le filtre de lecture du vérificateur portait
//   status IN ('VALIDATED','CLAIMED','REJECTED')
// → une attestation révoquée par l'admin APRÈS son émission tombait hors du
// filtre et le vérificateur public répondait 404 « aucun certificat trouvé »,
// c'est-à-dire la négation de la révocation pour un tiers qui scanne un PDF
// déjà imprimé. Transparence cassée (#224).
//
// Après :
//   status IN ('VALIDATED','CLAIMED','REJECTED','REVOKED') AND deletedAt IS NULL
//   - REVOKED est publié comme révocation explicite (200, statut + preuve),
//     sans motif ni auteur (whitelist #281) ;
//   - une ligne supprimée logiquement est INVISIBLE (404 générique). Choix
//     assumé : la suppression logique est une décision d'administration
//     (erreur de saisie, demande du titulaire, retrait frauduleux non
//     caractérisé) et non un statut opposable. Publier un statut « supprimée »
//     confirmerait publiquement l'existence d'une ligne retirée du registre et
//     exposerait un document sans document officiel associé. Le 404 générique
//     est aussi ce que reçoit un code réellement inexistant : aucune
//     information supplémentaire n'est divulguée.
import { vi, describe, it, expect, beforeEach } from "vitest";

const SEAL_SECRET = "revoked-test-secret-0123456789abcdef";

function revokedRow() {
  return {
    id: "a9",
    code: "FSA-2026-M01-00009-abcde",
    fullName: "Ibrahim Sossa",
    type: "CERTIFICATION",
    status: "REVOKED",
    certificationScore: 72,
    certificationMention: "ASSEZ_BIEN",
    stageScore: null,
    sessionId: "sess-secret-9",
    userId: "user-secret-9",
    formationId: "formation-secret-9",
    email: "ibrahim.sossa@example.com",
    gender: "M",
    birthDate: new Date("1991-02-03"),
    birthPlace: "Abomey-Calavi",
    issuingCompany: "FSA",
    certificationHours: 70,
    certificationObservations: "Observation interne confidentielle",
    stageHours: null,
    stageObservations: null,
    pdfKey: "attestations/FSA-2026-M01-00009-abcde/v1.pdf",
    pdfHash: "c".repeat(64),
    pdfVersion: 1,
    pdfGeneratedAt: new Date("2026-01-03T00:00:00Z"),
    issuedAt: new Date("2026-01-02T00:00:00Z"),
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-02"),
    location: "Cotonou, Bénin",
    instructor: "M. Adjovi",
    sealHash: null,
    sealedAt: new Date("2026-01-02T00:00:00Z"),
    sealVersion: 2,
    formation: { name: "Pisciculture", category: "AGRICULTURE" },
    // Champs du cycle de vie #299/#301 — jamais publiés.
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
    revokedAt: new Date("2026-06-01T00:00:00Z"),
    revokedById: "admin-secret-9",
    revokeReason: "Fraude avérée sur l'examen de certification",
    retrogradedAt: null,
    retrogradedById: null,
    retrogradeReason: null,
  };
}

const db = vi.hoisted(() => ({
  attestationFindFirst: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { attestation: { findFirst: db.attestationFindFirst } },
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: db.applyRateLimit,
}));

vi.mock("@/lib/sanitization", () => ({
  sanitizeInput: (value: string) => value,
}));

import { GET } from "../../app/api/verifier/route";

function req(code: string) {
  return new Request(`http://localhost/api/verifier?code=${encodeURIComponent(code)}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CERT_SEAL_SECRET = SEAL_SECRET;
  db.applyRateLimit.mockResolvedValue({ allowed: true } as never);
});

describe("#299/#301 — transparence du vérificateur sur REVOKED", () => {
  it("interroge le statut REVOKED, sinon une révocation répondrait 404", async () => {
    db.attestationFindFirst.mockResolvedValue(null as never);
    await GET(req("FSA-2026-M01-00009-abcde"));

    expect(db.attestationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: expect.arrayContaining(["VALIDATED", "CLAIMED", "REJECTED", "REVOKED"]) },
        }),
      }),
    );
  });

  it("exclut toute ligne supprimée logiquement de la lecture publique", async () => {
    db.attestationFindFirst.mockResolvedValue(null as never);
    await GET(req("FSA-2026-M01-00009-abcde"));

    expect(db.attestationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it("déclare la révocation (200) au lieu de répondre 404", async () => {
    db.attestationFindFirst.mockResolvedValue(revokedRow() as never);

    const res = await GET(req("FSA-2026-M01-00009-abcde"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attestation.status).toBe("REVOKED");
    expect(body.attestation.proof.revoked).toBe(true);
    expect(body.attestation.proof.valid).toBe(false);
    expect(typeof body.attestation.proof.reason).toBe("string");
    expect(body.attestation.proof.reason.length).toBeGreaterThan(0);
  });

  it("n'expose ni motif de révocation, ni auteur, ni PII du titulaire révoqué", async () => {
    db.attestationFindFirst.mockResolvedValue(revokedRow() as never);

    const res = await GET(req("FSA-2026-M01-00009-abcde"));
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(body.attestation).not.toHaveProperty("revokeReason");
    expect(body.attestation).not.toHaveProperty("revokedById");
    expect(body.attestation).not.toHaveProperty("revokedAt");
    expect(body.attestation).not.toHaveProperty("deleteReason");
    expect(body.attestation).not.toHaveProperty("deletedById");
    expect(body.attestation).not.toHaveProperty("fullName");
    expect(body.attestation).not.toHaveProperty("email");
    expect(body.attestation).not.toHaveProperty("userId");
    expect(body.attestation).not.toHaveProperty("sessionId");
    expect(body.attestation).not.toHaveProperty("formationId");

    expect(serialized).not.toContain("Fraude avérée");
    expect(serialized).not.toContain("admin-secret-9");
    expect(serialized).not.toContain("user-secret-9");
    expect(serialized).not.toContain("sess-secret-9");
    expect(serialized).not.toContain("ibrahim.sossa@example.com");
    expect(serialized).not.toContain("Abomey-Calavi");
  });

  it("conserve la whitelist minimale de #281 sur le cas REVOKED", async () => {
    db.attestationFindFirst.mockResolvedValue(revokedRow() as never);

    const res = await GET(req("FSA-2026-M01-00009-abcde"));
    const body = await res.json();

    expect(Object.keys(body.attestation).sort()).toEqual(["code", "proof", "status"]);
    expect(Object.keys(body.attestation.proof).sort()).toEqual(
      [
        "algorithm",
        "checkedAt",
        "reason",
        "revoked",
        "sealVersion",
        "sealed",
        "sealedAt",
        "status",
        "valid",
      ].sort(),
    );
  });

  it("répond 404 pour une attestation supprimée logiquement (choix documenté)", async () => {
    // `deletedAt IS NULL` est porté par le filtre : la base ne renvoie rien,
    // la route retombe donc sur son 404 générique, identique à un code
    // inexistant — aucun statut « supprimée » n'est publié.
    db.attestationFindFirst.mockResolvedValue(null as never);

    const res = await GET(req("FSA-2026-M01-00009-abcde"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Aucun certificat n'a été trouvé");
    expect(JSON.stringify(body)).not.toContain("supprim");
  });

  it("ne publie pas non plus une attestation supprimée logiquement ET révoquée", async () => {
    // Le filtre `deletedAt: null` prime : une ligne retirée du registre n'est
    // pas « révoquée publiquement », elle est invisible, même avec un REVOKED.
    db.attestationFindFirst.mockResolvedValue(null as never);

    const res = await GET(req("FSA-2026-M01-00009-abcde"));

    expect(res.status).toBe(404);
  });
});
