import { describe, it, expect } from "vitest";
import {
  toEmailVerifiedDate,
  isEmailVerified,
  normalizeEmailVerified,
} from "@/lib/email-verified";

describe("toEmailVerifiedDate - conversion centralisée", () => {
  it("convertit true en Date", () => {
    const result = toEmailVerifiedDate(true);
    expect(result).toBeInstanceOf(Date);
  });

  it("convertit false / null / undefined en null", () => {
    expect(toEmailVerifiedDate(false)).toBeNull();
    expect(toEmailVerifiedDate(null)).toBeNull();
    expect(toEmailVerifiedDate(undefined)).toBeNull();
  });

  it("conserve une Date existante", () => {
    const d = new Date("2024-01-01T00:00:00.000Z");
    expect(toEmailVerifiedDate(d)).toBe(d);
  });
});

describe("isEmailVerified", () => {
  it("vrai pour true et Date", () => {
    expect(isEmailVerified(true)).toBe(true);
    expect(isEmailVerified(new Date())).toBe(true);
  });

  it("faux pour false / null / undefined", () => {
    expect(isEmailVerified(false)).toBe(false);
    expect(isEmailVerified(null)).toBe(false);
    expect(isEmailVerified(undefined)).toBe(false);
  });
});

describe("normalizeEmailVerified", () => {
  it("normalise le champ quand présent", () => {
    expect(
      normalizeEmailVerified({ emailVerified: true }).emailVerified,
    ).toBeInstanceOf(Date);
    expect(
      normalizeEmailVerified({ emailVerified: false }).emailVerified,
    ).toBeNull();
  });

  it("retourne l'objet inchangé quand le champ est absent", () => {
    const input = { name: "test" };
    expect(normalizeEmailVerified(input)).toBe(input);
  });
});
