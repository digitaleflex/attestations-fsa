import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ enrollmentFindUnique: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { examEnrollment: { findUnique: db.enrollmentFindUnique } },
}));

import { checkExamEligibility } from "@/lib/exams/eligibility";

beforeEach(() => {
  vi.clearAllMocks();
  db.enrollmentFindUnique.mockResolvedValue(null);
});

describe("checkExamEligibility", () => {
  it("refuse un OFFICIAL sans enrollment", async () => {
    await expect(
      checkExamEligibility({
        userId: "user-1",
        examId: "official-1",
        examType: "OFFICIAL",
      }),
    ).resolves.toMatchObject({ eligible: false, code: "EXAM_NOT_ENROLLED" });
    expect(db.enrollmentFindUnique).toHaveBeenCalledWith({
      where: { userId_examId: { userId: "user-1", examId: "official-1" } },
      // `status` est relu : une inscription révoquée ne vaut pas éligibilité.
      select: { id: true, status: true },
    });
  });

  it("accepte un OFFICIAL avec l'enrollment exact", async () => {
    db.enrollmentFindUnique.mockResolvedValue({
      id: "enrollment-1",
      status: "ACTIVE",
    });
    await expect(
      checkExamEligibility({
        userId: "user-1",
        examId: "official-1",
        examType: "OFFICIAL",
      }),
    ).resolves.toEqual({ eligible: true });
  });

  // #256 — la révocation est logique : la ligne reste en base pour la
  // traçabilité mais n'ouvre plus aucun accès.
  it("refuse un OFFICIAL dont l'inscription est révoquée", async () => {
    db.enrollmentFindUnique.mockResolvedValue({
      id: "enrollment-1",
      status: "REVOKED",
    });
    await expect(
      checkExamEligibility({
        userId: "user-1",
        examId: "official-1",
        examType: "OFFICIAL",
      }),
    ).resolves.toMatchObject({
      eligible: false,
      code: "EXAM_ENROLLMENT_REVOKED",
    });
  });

  it("refuse un OFFICIAL dont le statut d'inscription est inconnu", async () => {
    db.enrollmentFindUnique.mockResolvedValue({
      id: "enrollment-1",
      status: "SUPPRIMEE_PAR_UN_ANCIEN_SCRIPT",
    });
    await expect(
      checkExamEligibility({
        userId: "user-1",
        examId: "official-1",
        examType: "OFFICIAL",
      }),
    ).resolves.toMatchObject({
      eligible: false,
      code: "EXAM_ENROLLMENT_INVALID",
    });
  });

  it("traite un statut absent (ligne antérieure au lot) comme invalide, jamais comme actif", async () => {
    db.enrollmentFindUnique.mockResolvedValue({ id: "enrollment-1" });
    await expect(
      checkExamEligibility({
        userId: "user-1",
        examId: "official-1",
        examType: "OFFICIAL",
      }),
    ).resolves.toMatchObject({ eligible: false });
  });

  it("accepte MOCK sans requête d'enrollment", async () => {
    await expect(
      checkExamEligibility({
        userId: "user-1",
        examId: "mock-1",
        examType: "MOCK",
      }),
    ).resolves.toEqual({ eligible: true });
    expect(db.enrollmentFindUnique).not.toHaveBeenCalled();
  });

  it("accepte un MOCK même si une inscription existe et est révoquée", async () => {
    // Le MOCK est un entraînement ouvert : la révocation d'un OFFICIAL ne
    // doit pas fermer l'entraînement (comportement documenté dans le lot B).
    await expect(
      checkExamEligibility({
        userId: "user-1",
        examId: "mock-1",
        examType: "MOCK",
      }),
    ).resolves.toEqual({ eligible: true });
    expect(db.enrollmentFindUnique).not.toHaveBeenCalled();
  });

  it("n'accorde le contournement que pour un admin explicite", async () => {
    await expect(
      checkExamEligibility({
        userId: "admin-1",
        examId: "official-1",
        examType: "OFFICIAL",
        isAdmin: true,
      }),
    ).resolves.toEqual({ eligible: true });
    expect(db.enrollmentFindUnique).not.toHaveBeenCalled();
  });
});
