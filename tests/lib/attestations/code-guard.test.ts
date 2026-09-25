import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCodeUnchanged,
  ATTESTATION_CODE_PATTERN,
  AttestationCodeImmutableError,
  CODE_IMMUTABLE_MESSAGE,
  isAttestationCodeImmutableError,
  isFsaCode,
  withImmutableCode,
} from "../../../lib/attestations/code-guard";

const root = resolve(__dirname, "../../..");
const MIGRATION = "prisma/migrations/20260927_attestation_code_immutability/migration.sql";

describe("immuabilité du code FSA — garde applicative (#255)", () => {
  it("reconnaît le format de code FSA", () => {
    expect(isFsaCode("FSA-2025-M03-00012-abcde")).toBe(true);
    expect(isFsaCode("FSA-2025-M13-00012-abcde")).toBe(false);
    expect(isFsaCode("fsa-2025-m03-00012-abcde")).toBe(false);
    expect(isFsaCode(42)).toBe(false);
    expect(ATTESTATION_CODE_PATTERN.source).toBe(REFERENCE_PATTERN_SOURCE);
  });

  it("refuse toute mise à jour qui touche le code, et tolère l'absence de code", () => {
    expect(() => assertCodeUnchanged({ code: "FSA-2025-M03-00012-abcde" }, { status: "VALIDATED" } as { code?: unknown })).not.toThrow();
    expect(() => assertCodeUnchanged({ code: "FSA-2025-M03-00012-abcde" }, { code: "FSA-2025-M03-00012-abcde" })).not.toThrow();
    expect(() => assertCodeUnchanged({ code: "FSA-2025-M03-00012-abcde" }, { code: undefined })).not.toThrow();
    expect(() => assertCodeUnchanged({ code: "FSA-2025-M03-00012-abcde" }, { code: "FSA-2026-M01-00001-aaaaa" })).toThrow(
      AttestationCodeImmutableError,
    );
    expect(() => assertCodeUnchanged(null, { code: "FSA-2025-M03-00012-abcde" })).toThrow(AttestationCodeImmutableError);
  });

  it("retire `code` des données soumises plutôt que de l'écraser silencieusement", () => {
    const data = withImmutableCode({ code: "FSA-2025-M03-00012-abcde" }, { status: "REJECTED", code: undefined });
    expect(data).toEqual({ status: "REJECTED" });
    expect("code" in data).toBe(false);
  });

  it("traduit l'erreur du trigger PostgreSQL en erreur métier", () => {
    expect(isAttestationCodeImmutableError(new AttestationCodeImmutableError())).toBe(true);
    expect(isAttestationCodeImmutableError(new Error('ATTESTATION_CODE_IMMUTABLE: Attestation.code est immuable'))).toBe(true);
    expect(isAttestationCodeImmutableError("le code est immuable")).toBe(true);
    expect(isAttestationCodeImmutableError(new Error("contrainte de clé étrangère"))).toBe(false);
    expect(isAttestationCodeImmutableError(null)).toBe(false);
    expect(CODE_IMMUTABLE_MESSAGE).not.toContain("FSA-");
  });
});

describe("immuabilité du code FSA — défense en profondeur SQL (#255)", () => {
  const sql = readFileSync(resolve(root, MIGRATION), "utf8");

  it("installe un trigger BEFORE UPDATE qui ne refuse QUE la modification du code", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION fsa_attestation_code_is_immutable()");
    expect(sql).toMatch(/BEFORE UPDATE ON "Attestation"/);
    expect(sql).toContain('NEW."code" IS DISTINCT FROM OLD."code"');
    // Aucune garde ne doit porter sur une autre colonne ni sur l'INSERT.
    expect(sql).not.toMatch(/BEFORE INSERT/);
    expect(sql).not.toMatch(/BEFORE DELETE/);
  });

  it("est idempotent et applicable plusieurs fois sans erreur", () => {
    expect(sql).toContain("DROP TRIGGER IF EXISTS \"attestation_code_immutability\"");
    expect(sql.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(1);
  });

  it("ne modifie aucune ligne existante (migration additive)", () => {
    expect(sql).not.toMatch(/^\s*(UPDATE |DELETE |INSERT INTO|TRUNCATE |DROP TABLE)/im);
    expect(sql).not.toMatch(/ALTER TABLE/);
  });

  it("ne divulgue pas la valeur du code dans le message d'erreur", () => {
    const raise = /RAISE EXCEPTION\s+'([^']+)'/im.exec(sql)?.[1] ?? "";
    expect(raise).toContain("ATTESTATION_CODE_IMMUTABLE");
    expect(raise).not.toMatch(/FSA-|OLD\."code"|NEW\."code"/);
  });

  it("n'ouvre aucun chemin d'écriture de code dans le code applicatif", () => {
    // Aucun `data: { code }` ni `code:` dans une mise à jour/création Prisma.
    const files = [
      "app/api/attestations/route.ts",
      "app/api/attestations/[id]/route.ts",
      "app/api/admin/attestations/[id]/actions/route.ts",
      "app/api/user/claim-code/route.ts",
      "app/api/user/attestations/[id]/claim/route.ts",
      "app/api/auth/fsa-login/route.ts",
      "app/api/admin/corrections/route.ts",
      "lib/attestations/issue.ts",
    ];
    for (const file of files) {
      const source = readFileSync(resolve(root, file), "utf8");
      for (const match of source.matchAll(/(?:create|update|upsert)\(\{[\s\S]{0,600}?\n\s*\}\)/g)) {
        expect(match[0], `${file} ne doit jamais écrire le code`).not.toMatch(/\bcode\s*:/);
      }
    }
  });
});

const REFERENCE_PATTERN_SOURCE = "^FSA-(\\d{4})-M(\\d{2})-(\\d{5})-([0-9a-f]{5})$";
