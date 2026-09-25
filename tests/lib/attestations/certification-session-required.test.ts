import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `sessionId` obligatoire pour toute nouvelle CERTIFICATION (#258).
 *
 * Deux lignes de défense, vérifiées ici :
 *  1. la contrainte SQL `NOT VALID` — elle n'inspecte pas les ~40 attestations
 *     historiques, mais PostgreSQL l'applique à toute insertion et à toute
 *     mise à jour future ;
 *  2. le code applicatif — aucune route ne crée de CERTIFICATION hors du hub
 *     d'émission lié à une session OFFICIAL GRADED.
 */

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

const MIGRATION = read(
  "prisma/migrations/20260925_official_attestation_proof/migration.sql",
);
const CREATE_ROUTE = read("app/api/attestations/route.ts");
const HUB = read("lib/attestations/issue.ts");
const INTERNSHIP_ROUTE = read("app/api/admin/internships/[id]/attestation/route.ts");
const GRADING_ROUTE = read("app/api/admin/submissions/[id]/correct/route.ts");
const SCHEMA = read("prisma/schema.prisma");

describe("contrainte SQL — session obligatoire (#258)", () => {
  it("existe en NOT VALID : les attestations historiques restent valables", () => {
    expect(MIGRATION).toContain("Attestation_certification_session_required");
    expect(MIGRATION).toMatch(
      /CHECK \("type" <> 'CERTIFICATION' OR "sessionId" IS NOT NULL\) NOT VALID/,
    );
  });

  it("l'unicité par session empêche toute double émission", () => {
    expect(MIGRATION).toContain('CREATE UNIQUE INDEX "Attestation_sessionId_key"');
    expect(SCHEMA).toMatch(/@@unique\(\[sessionId\]\)/);
  });

  it("le schéma expose les colonnes de preuve PDF sans casser les lignes TEXT historiques", () => {
    expect(SCHEMA).toMatch(/pdfKey\s+String\?/);
    expect(SCHEMA).toMatch(/pdfHash\s+String\?/);
    expect(SCHEMA).toMatch(/pdfVersion\s+Int\?/);
    expect(SCHEMA).toMatch(/pdfGeneratedAt\s+DateTime\?/);
    expect(SCHEMA).toMatch(/sealVersion\s+Int\?/);
    expect(SCHEMA).toMatch(/sessionId\s+String\?/);
  });
});

describe("code applicatif — aucune CERTIFICATION sans session", () => {
  it("la création manuelle d'attestation refuse CERTIFICATION", () => {
    expect(CREATE_ROUTE).toContain("if (type === 'CERTIFICATION')");
    expect(CREATE_ROUTE).toMatch(/status: 422/);
  });

  it("le hub d'émission exige la session et l'écrit en base", () => {
    expect(HUB).toMatch(/issueExamAttestation\(\s*\n?\s*sessionId: string/);
    expect(HUB).toMatch(/if \(!sessionId\?\.trim\(\)\)/);
    expect(HUB).toMatch(/type: "CERTIFICATION",/);
    expect(HUB).toMatch(/\n\s+sessionId,\n/);
  });

  it("les autres voies de création ne produisent que des STAGE", () => {
    expect(INTERNSHIP_ROUTE).toMatch(/type: 'STAGE'/);
    expect(INTERNSHIP_ROUTE).not.toMatch(/type: 'CERTIFICATION'/);
  });

  it("la correction d'une session OFFICIAL passe par le hub unique", () => {
    expect(GRADING_ROUTE).toContain("issueExamAttestation");
    expect(GRADING_ROUTE).not.toMatch(/attestation\.create\(/);
  });
});
