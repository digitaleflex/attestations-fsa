import { describe, it, expect } from "vitest";

import {
  INTERNSHIPS_EXPORT_PAGE_SIZE_DEFAULT,
  INTERNSHIPS_PAGE_SIZE_DEFAULT,
  INTERNSHIPS_PAGE_SIZE_MAX,
  buildPagination,
  internshipExportQuerySchema,
  internshipListQuerySchema,
  internshipStatusPatchSchema,
} from "@/lib/internships/schemas";

describe("#267 — validation des entrées admin (stages)", () => {
  describe("liste admin", () => {
    it("défauts : page 1, pageSize 20, pas de filtre", () => {
      expect(
        internshipListQuerySchema.parse({
          page: undefined,
          pageSize: undefined,
          status: undefined,
        }),
      ).toEqual({
        page: 1,
        pageSize: INTERNSHIPS_PAGE_SIZE_DEFAULT,
        status: null,
      });
    });

    it("status=ALL → aucun filtre", () => {
      expect(internshipListQuerySchema.parse({ status: "ALL" }).status).toBeNull();
    });

    it("status hors enum → erreur de validation", () => {
      expect(() => internshipListQuerySchema.parse({ status: "CANCELLED" })).toThrow();
    });

    it("page non entière / < 1 → erreur", () => {
      expect(() => internshipListQuerySchema.parse({ page: "0" })).toThrow();
      expect(() => internshipListQuerySchema.parse({ page: "abc" })).toThrow();
    });

    it("pageSize borné au maximum (pas de take non borné)", () => {
      expect(
        internshipListQuerySchema.parse({ pageSize: "100000" }).pageSize,
      ).toBe(INTERNSHIPS_PAGE_SIZE_MAX);
    });
  });

  describe("export", () => {
    it("défauts : page 1, pageSize 50", () => {
      expect(
        internshipExportQuerySchema.parse({
          page: undefined,
          pageSize: undefined,
          status: undefined,
        }),
      ).toEqual({
        page: 1,
        pageSize: INTERNSHIPS_EXPORT_PAGE_SIZE_DEFAULT,
        status: null,
      });
    });

    it("filtre valide conservé", () => {
      expect(internshipExportQuerySchema.parse({ status: "ACCEPTED" }).status).toBe(
        "ACCEPTED",
      );
    });
  });

  describe("PATCH statut", () => {
    it("accepte un statut de l'enum", () => {
      expect(
        internshipStatusPatchSchema.parse({ id: "i1", status: "ARCHIVED" }),
      ).toEqual({ id: "i1", status: "ARCHIVED" });
    });

    it("refuse un statut libre/inconnu", () => {
      expect(() =>
        internshipStatusPatchSchema.parse({ id: "i1", status: "SUPPRIME" }),
      ).toThrow();
    });

    it("refuse un identifiant vide", () => {
      expect(() =>
        internshipStatusPatchSchema.parse({ id: "", status: "ACCEPTED" }),
      ).toThrow();
    });
  });

  describe("buildPagination", () => {
    it("calcule totalPages", () => {
      expect(buildPagination({ page: 1, pageSize: 20 }, 45)).toEqual({
        page: 1,
        pageSize: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it("liste vide → totalPages 1 (pas de division par zéro)", () => {
      expect(buildPagination({ page: 1, pageSize: 20 }, 0)).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
      });
    });
  });
});
