// tests/api/verifier-public-whitelist.test.ts
// #281 — La réponse publique de GET /api/verifier doit être une WHITELIST
// stricte : plus de `...attestation` (qui republiait toute la ligne Prisma).
//
// Avant : la route renvoyait l'objet `attestation` complet, donc email,
// birthDate, birthPlace, gender, location, instructor, userId, sessionId,
// formationId, issuingCompany, observations internes, pdfKey… étaient
// accessibles à quiconque connaissait un code — et le payload augmentait à
// chaque nouveau champ du schéma Prisma (fuite silencieuse par défaut).
//
// Après : seuls les champs utiles à un vérificateur tiers sont publiés
// (identité du document, nom, type, statut, dates de validité, score,
// formation, preuve de scellement + métadonnées PDF). Le parcours public
// (QR / nom / formation / statut / téléchargement) reste intact.
import { vi, describe, it, expect, beforeEach } from "vitest";
import { sealCertificate } from "@/lib/crypto/seal";

const SEAL_SECRET = "whitelist-test-secret-0123456789abc";

/** Ligne Prisma « maximale » : tout ce que la route pourrait republier. */
function fullRow() {
  const endDate = new Date("2026-01-02");
  const base = {
    id: "a1",
    code: "FSA-2026-M01-00001-abcde",
    fullName: "Alice Koffi",
    type: "CERTIFICATION",
    status: "VALIDATED",
    certificationScore: 88,
    certificationMention: "TRES_BIEN",
    stageScore: 90,
    sessionId: "sess-secret-1",
    userId: "user-secret-1",
    formationId: "formation-secret-1",
    email: "alice.koffi@example.com",
    gender: "F",
    birthDate: new Date("1990-05-04"),
    birthPlace: "Cotonou",
    issuingCompany: "FSA",
    certificationHours: 70,
    certificationObservations: "Observation interne confidentielle",
    stageHours: 6,
    stageObservations: "Observation interne de stage",
    pdfKey: "attestations/FSA-2026-M01-00001-abcde/v1.pdf",
    pdfHash: "b".repeat(64),
    pdfVersion: 1,
    pdfGeneratedAt: new Date("2026-01-03T00:00:00Z"),
    issuedAt: new Date("2026-01-02T00:00:00Z"),
    startDate: new Date("2026-01-01"),
    endDate,
    location: "Cotonou, Bénin",
    instructor: "M. Adjovi",
    sealVersion: 2,
    formation: { name: "Pisciculture", category: "AGRICULTURE" },
  };
  const seal = sealCertificate(
    {
      sealVersion: base.sealVersion,
      code: base.code,
      type: base.type,
      status: base.status,
      sessionId: base.sessionId,
      userId: base.userId,
      formationId: base.formationId,
      formationName: base.formation.name,
      fullName: base.fullName,
      email: base.email,
      gender: base.gender,
      birthDate: base.birthDate,
      birthPlace: base.birthPlace,
      startDate: base.startDate,
      endDate: base.endDate,
      issuedAt: base.issuedAt,
      location: base.location,
      instructor: base.instructor,
      issuingCompany: base.issuingCompany,
      certificationHours: base.certificationHours,
      certificationMention: base.certificationMention,
      certificationObservations: base.certificationObservations,
      certificationScore: base.certificationScore,
      stageHours: base.stageHours,
      stageObservations: base.stageObservations,
      stageScore: base.stageScore,
      pdfKey: base.pdfKey,
      pdfHash: base.pdfHash,
      pdfVersion: base.pdfVersion,
      pdfGeneratedAt: base.pdfGeneratedAt,
      sealHash: null,
    },
    SEAL_SECRET,
  )!;
  return { ...base, sealHash: seal.sealHash, sealedAt: seal.sealedAt };
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

async function body() {
  const res = await GET(req("FSA-2026-M01-00001-abcde"));
  expect(res.status).toBe(200);
  return (await res.json()) as { attestation: Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CERT_SEAL_SECRET = SEAL_SECRET;
  db.applyRateLimit.mockResolvedValue({ allowed: true } as never);
  db.attestationFindFirst.mockResolvedValue(fullRow() as never);
});

describe("#281 — whitelist stricte de la réponse publique du vérificateur", () => {
  it("publie exactement les champs publics attendus, rien de plus", async () => {
    const { attestation } = await body();

    expect(Object.keys(attestation).sort()).toEqual(
      [
        "code",
        "endDate",
        "formation",
        "fullName",
        "id",
        "issuedAt",
        "proof",
        "score",
        "startDate",
        "status",
        "type",
      ].sort(),
    );
  });

  it("ne publie jamais l'email du titulaire", async () => {
    const { attestation } = await body();
    expect(attestation).not.toHaveProperty("email");
    expect(JSON.stringify(attestation)).not.toContain("alice.koffi@example.com");
  });

  it("ne publie jamais la date ni le lieu de naissance", async () => {
    const { attestation } = await body();
    expect(attestation).not.toHaveProperty("birthDate");
    expect(attestation).not.toHaveProperty("birthPlace");
    expect(attestation).not.toHaveProperty("gender");
    expect(JSON.stringify(attestation)).not.toContain("Cotonou");
  });

  it("ne publie ni le lieu de formation ni le formateur", async () => {
    const { attestation } = await body();
    expect(attestation).not.toHaveProperty("location");
    expect(attestation).not.toHaveProperty("instructor");
    expect(JSON.stringify(attestation)).not.toContain("M. Adjovi");
  });

  it("ne publie aucun identifiant interne (userId, sessionId, formationId)", async () => {
    const { attestation } = await body();
    expect(attestation).not.toHaveProperty("userId");
    expect(attestation).not.toHaveProperty("sessionId");
    expect(attestation).not.toHaveProperty("formationId");
    const serialized = JSON.stringify(attestation);
    expect(serialized).not.toContain("user-secret-1");
    expect(serialized).not.toContain("sess-secret-1");
    expect(serialized).not.toContain("formation-secret-1");
  });

  it("ne publie ni les observations internes ni la clé brute du PDF", async () => {
    const { attestation } = await body();
    expect(attestation).not.toHaveProperty("certificationObservations");
    expect(attestation).not.toHaveProperty("stageObservations");
    expect(attestation).not.toHaveProperty("pdfKey");
    expect(attestation).not.toHaveProperty("sealHash");
    expect(attestation).not.toHaveProperty("certificationScore");
    expect(attestation).not.toHaveProperty("stageScore");
    expect(attestation).not.toHaveProperty("certificationMention");
    expect(attestation).not.toHaveProperty("issuingCompany");
    expect(attestation).not.toHaveProperty("certificationHours");
    expect(attestation).not.toHaveProperty("stageHours");
    expect(JSON.stringify(attestation)).not.toContain("confidentielle");
  });

  it("garde le parcours public : code, nom, formation, statut, dates, score", async () => {
    const { attestation } = await body();

    expect(attestation.code).toBe("FSA-2026-M01-00001-abcde");
    expect(attestation.id).toBe("a1");
    expect(attestation.fullName).toBe("Alice Koffi");
    expect(attestation.type).toBe("CERTIFICATION");
    expect(attestation.status).toBe("VALIDATED");
    expect(attestation.score).toBe(88);
    expect(attestation.issuedAt).toBeTruthy();
    expect(attestation.startDate).toBeTruthy();
    expect(attestation.endDate).toBeTruthy();
    expect(attestation.formation).toEqual({ name: "Pisciculture", category: "AGRICULTURE" });
  });

  it("garde la preuve de scellement complète, PDF compris (QR / authenticité)", async () => {
    const { attestation } = await body();
    const proof = attestation.proof as {
      algorithm: string;
      sealed: boolean;
      valid: boolean;
      revoked: boolean;
      sealVersion: number;
      sealedAt: string;
      checkedAt: string;
      pdf: {
        available: boolean;
        version: number;
        hash: string;
        generatedAt: string;
        downloadPath: string;
      };
    };

    expect(proof.algorithm).toBe("HMAC-SHA256");
    expect(proof.sealed).toBe(true);
    expect(proof.valid).toBe(true);
    expect(proof.revoked).toBe(false);
    expect(proof.sealVersion).toBe(2);
    expect(typeof proof.sealedAt).toBe("string");
    expect(typeof proof.checkedAt).toBe("string");

    // Le parcours de téléchargement du document officiel reste disponible.
    expect(proof.pdf.available).toBe(true);
    expect(proof.pdf.version).toBe(1);
    expect(proof.pdf.hash).toBe("b".repeat(64));
    expect(typeof proof.pdf.generatedAt).toBe("string");
    expect(proof.pdf.downloadPath).toBe("/api/verifier/pdf?code=FSA-2026-M01-00001-abcde");
  });

  it("applique la même whitelist au cas REJECTED (aucune PII du titulaire)", async () => {
    db.attestationFindFirst.mockResolvedValue({
      ...fullRow(),
      status: "REJECTED",
    } as never);

    const { attestation } = await body();

    expect(attestation.status).toBe("REJECTED");
    expect(Object.keys(attestation).sort()).toEqual(["code", "proof", "status"]);
    expect(attestation).not.toHaveProperty("fullName");
    expect(attestation).not.toHaveProperty("email");
    expect(attestation).not.toHaveProperty("userId");
    expect(attestation).not.toHaveProperty("sessionId");
    const proof = attestation.proof as { revoked: boolean; valid: boolean; reason: string };
    expect(proof.revoked).toBe(true);
    expect(proof.valid).toBe(false);
    expect(proof.reason.length).toBeGreaterThan(0);
  });

  it("ne dépend d'aucun spread : un champ Prisma ajouté demain reste privé", async () => {
    // Simule l'ajout d'une colonne sensible par une migration future : la route
    // ne doit pas la republier, puisqu'elle ne fait plus d spread de la ligne.
    db.attestationFindFirst.mockResolvedValue({
      ...fullRow(),
      nationalIdNumber: "BEN-0123456789",
    } as never);

    const { attestation } = await body();

    expect(attestation).not.toHaveProperty("nationalIdNumber");
    expect(JSON.stringify(attestation)).not.toContain("BEN-0123456789");
  });
});
