import { describe, it, expect } from "vitest";

import {
  INTERNSHIP_STATUS_TRANSITIONS,
  INTERNSHIP_STATUSES,
  allowedNextInternshipStatuses,
  canTransitionInternshipStatus,
  isInternshipStatus,
  validateInternshipStatusTransition,
} from "@/lib/internships/state-machine";

describe("#267 — machine à états des demandes de stage", () => {
  it("expose exactement les 5 statuts de l'enum InternshipStatus", () => {
    expect([...INTERNSHIP_STATUSES]).toEqual([
      "PENDING",
      "REVIEWING",
      "ACCEPTED",
      "REJECTED",
      "ARCHIVED",
    ]);
  });

  it("reconnaît les statuts valides et rejette les autres", () => {
    expect(isInternshipStatus("ACCEPTED")).toBe(true);
    expect(isInternshipStatus("accepted")).toBe(false);
    expect(isInternshipStatus("CANCELLED")).toBe(false);
    expect(isInternshipStatus(null)).toBe(false);
    expect(isInternshipStatus(42)).toBe(false);
  });

  it("matrice : PENDING → REVIEWING/ACCEPTED/REJECTED/ARCHIVED", () => {
    expect([...INTERNSHIP_STATUS_TRANSITIONS.PENDING].sort()).toEqual(
      ["ACCEPTED", "ARCHIVED", "REJECTED", "REVIEWING"].sort(),
    );
  });

  it("matrice : REVIEWING est un point de passage réversible", () => {
    expect(canTransitionInternshipStatus("REVIEWING", "PENDING")).toBe(true);
    expect(canTransitionInternshipStatus("REVIEWING", "ACCEPTED")).toBe(true);
    expect(canTransitionInternshipStatus("REVIEWING", "REJECTED")).toBe(true);
    expect(canTransitionInternshipStatus("REVIEWING", "ARCHIVED")).toBe(true);
  });

  it("transition vers le même statut toujours autorisée (no-op)", () => {
    for (const status of INTERNSHIP_STATUSES) {
      expect(canTransitionInternshipStatus(status, status)).toBe(true);
    }
  });

  it("ARCHIVED est terminal : aucune sortie autorisée", () => {
    for (const target of INTERNSHIP_STATUSES) {
      expect(canTransitionInternshipStatus("ARCHIVED", target)).toBe(target === "ARCHIVED");
    }
    expect(INTERNSHIP_STATUS_TRANSITIONS.ARCHIVED).toHaveLength(0);
  });

  it("interdit les transitions interdites (réouverture sans réexamen)", () => {
    // Réouverture d'un refus sans repasser par REVIEWING.
    expect(canTransitionInternshipStatus("REJECTED", "ACCEPTED")).toBe(false);
    expect(canTransitionInternshipStatus("REJECTED", "PENDING")).toBe(false);
    // Archivage puis réanimation.
    expect(canTransitionInternshipStatus("ARCHIVED", "PENDING")).toBe(false);
    expect(canTransitionInternshipStatus("ARCHIVED", "ACCEPTED")).toBe(false);
  });

  describe("validateInternshipStatusTransition", () => {
    it("statut demandé hors enum → 400 INVALID_INTERNSHIP_STATUS", () => {
      const result = validateInternshipStatusTransition({
        from: "PENDING",
        to: "CANCELLED",
      });
      expect(result).toMatchObject({
        ok: false,
        status: 400,
        code: "INVALID_INTERNSHIP_STATUS",
      });
    });

    it("statut courant inconnu → 400 (donnée legacy)", () => {
      const result = validateInternshipStatusTransition({
        from: "UNKNOWN_LEGACY",
        to: "ACCEPTED",
      });
      expect(result).toMatchObject({
        ok: false,
        status: 400,
        code: "INVALID_INTERNSHIP_STATUS",
      });
    });

    it("transition interdite → 400 INVALID_INTERNSHIP_STATUS_TRANSITION", () => {
      const result = validateInternshipStatusTransition({
        from: "REJECTED",
        to: "ACCEPTED",
      });
      expect(result).toMatchObject({
        ok: false,
        status: 400,
        code: "INVALID_INTERNSHIP_STATUS_TRANSITION",
      });
      if (!result.ok) expect(result.message).toContain("REJECTED → ACCEPTED");
    });

    it("statut absent (null) → no-op autorisé", () => {
      expect(validateInternshipStatusTransition({ from: "PENDING", to: null })).toEqual({
        ok: true,
        from: "PENDING",
        to: null,
      });
    });

    it("statut courant inconnu (from null) → seule la valeur demandée est validée", () => {
      expect(validateInternshipStatusTransition({ from: null, to: "ACCEPTED" })).toEqual({
        ok: true,
        from: null,
        to: "ACCEPTED",
      });
    });

    it("transition autorisée → ok", () => {
      expect(
        validateInternshipStatusTransition({ from: "PENDING", to: "REVIEWING" }),
      ).toEqual({ ok: true, from: "PENDING", to: "REVIEWING" });
    });
  });

  it("allowedNextInternshipStatuses expose le no-op + les transitions", () => {
    expect(allowedNextInternshipStatuses("PENDING").sort()).toEqual(
      ["ACCEPTED", "ARCHIVED", "PENDING", "REJECTED", "REVIEWING"].sort(),
    );
    expect(allowedNextInternshipStatuses("ARCHIVED")).toEqual(["ARCHIVED"]);
    expect(allowedNextInternshipStatuses(null).sort()).toEqual(
      [...INTERNSHIP_STATUSES].sort(),
    );
  });
});
