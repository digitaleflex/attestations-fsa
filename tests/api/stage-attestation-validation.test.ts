// #266 — Validation stricte du corps de génération d'une attestation de stage.
import { describe, it, expect } from "vitest";

import {
  FORBIDDEN_IDENTITY_FIELDS,
  STAGE_LIMITS,
  validateStageAttestationInput,
} from "@/lib/stage-attestation/validation";

const base = { startDate: "2026-01-01", endDate: "2026-06-01" };

function ok(input: unknown = base) {
  return validateStageAttestationInput(input);
}

describe("#266 validation du corps d'attestation de stage", () => {
  it("accepte un corps minimal valide", () => {
    const result = ok();
    expect(result.success).toBe(true);
  });

  it("accepte un score numérique ou chaîne numérique", () => {
    expect(ok({ ...base, stageScore: 0 }).success).toBe(true);
    expect(ok({ ...base, stageScore: 100 }).success).toBe(true);
    expect(ok({ ...base, stageScore: "87.5" }).success).toBe(true);
  });

  it("accepte les bornes exactes 0 et 100", () => {
    expect(ok({ ...base, stageScore: 0 })).toMatchObject({ success: true });
    expect(ok({ ...base, stageScore: 100 })).toMatchObject({ success: true });
  });

  describe("score borné 0-100", () => {
    it.each([
      ["négatif", -1],
      ["supérieur à 100", 100.01],
      ["très grand", 1_000_000],
    ])("refuse un score %s", (_label, score) => {
      const result = ok({ ...base, stageScore: score });
      expect(result.success).toBe(false);
    });

    it.each([
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["chaîne vide", ""],
      ["chaîne non numérique", "abc"],
      ["null", null],
      ["Infinity en chaîne", "Infinity"],
    ])("refuse un score %s", (_label, stageScore) => {
      const result = ok({ ...base, stageScore });
      expect(result.success).toBe(false);
    });

    it("borne aussi la forme chaîne (score en chaîne hors bornes)", () => {
      expect(ok({ ...base, stageScore: "120" }).success).toBe(false);
      expect(ok({ ...base, stageScore: "-5" }).success).toBe(false);
    });

    it("normalise un score chaîne valide", () => {
      const result = ok({ ...base, stageScore: " 75 " });
      expect(result).toMatchObject({ success: true });
    });
  });

  describe("dates", () => {
    it("refuse une date non ISO", () => {
      expect(ok({ startDate: "01/01/2026", endDate: "2026-06-01" }).success).toBe(false);
      expect(ok({ startDate: "2026-1-1", endDate: "2026-06-01" }).success).toBe(false);
    });

    it("refuse une date calendaire inexistante", () => {
      expect(ok({ startDate: "2026-02-31", endDate: "2026-06-01" }).success).toBe(false);
    });

    it("refuse une date trop ancienne ou trop future", () => {
      expect(ok({ startDate: "1970-01-01", endDate: "2026-06-01" }).success).toBe(false);
      expect(ok({ startDate: "2026-01-01", endDate: "9999-01-01" }).success).toBe(false);
    });

    it("accepte startDate === endDate", () => {
      expect(ok({ startDate: "2026-01-01", endDate: "2026-01-01" }).success).toBe(true);
    });

    it("refuse endDate antérieure à startDate", () => {
      const result = ok({ startDate: "2026-06-01", endDate: "2026-01-01" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.some((i) => i.path === "endDate")).toBe(true);
      }
    });

    it("refuse une date manquante", () => {
      expect(ok({ endDate: "2026-06-01" }).success).toBe(false);
      expect(ok({ startDate: "2026-01-01" }).success).toBe(false);
    });

    it("accepte une date-heure ISO complète", () => {
      expect(
        ok({ startDate: "2026-01-01T08:00:00.000Z", endDate: "2026-06-01T17:00:00+01:00" }).success,
      ).toBe(true);
    });
  });

  describe("longueurs des champs texte", () => {
    it("refuse un lieu trop long", () => {
      expect(ok({ ...base, location: "a".repeat(STAGE_LIMITS.location + 1) }).success).toBe(false);
    });

    it("refuse un responsable trop long", () => {
      expect(ok({ ...base, instructor: "b".repeat(STAGE_LIMITS.instructor + 1) }).success).toBe(false);
    });

    it("refuse des observations trop longues", () => {
      expect(
        ok({ ...base, stageObservations: "c".repeat(STAGE_LIMITS.observations + 1) }).success,
      ).toBe(false);
    });

    it("refuse une chaîne vide explicite", () => {
      expect(ok({ ...base, location: "   " }).success).toBe(false);
    });

    it("accepte les longueurs exactly aux bornes", () => {
      expect(ok({ ...base, location: "a".repeat(STAGE_LIMITS.location) }).success).toBe(true);
    });

    it("refuse un type non texte", () => {
      expect(ok({ ...base, location: 42 }).success).toBe(false);
    });
  });

  describe("identité : jamais de valeur fournie par le client", () => {
    it.each(FORBIDDEN_IDENTITY_FIELDS)("refuse %s dans le corps", (field) => {
      const result = ok({ ...base, [field]: "1995-01-01" });
      expect(result.success).toBe(false);
    });

    it("refuse un corps qui n'est pas un objet", () => {
      expect(validateStageAttestationInput(null).success).toBe(false);
      expect(validateStageAttestationInput("2026-01-01").success).toBe(false);
      expect(validateStageAttestationInput([base]).success).toBe(false);
    });
  });

  it("ne renvoie jamais la valeur rejetée dans les issues", () => {
    const secret = "PII-SECRET-VALUE ".repeat(200);
    const result = ok({ ...base, stageObservations: secret });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.issues)).not.toContain(secret);
    }
  });
});
