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
      select: { id: true },
    });
  });

  it("accepte un OFFICIAL avec l'enrollment exact", async () => {
    db.enrollmentFindUnique.mockResolvedValue({ id: "enrollment-1" });
    await expect(
      checkExamEligibility({
        userId: "user-1",
        examId: "official-1",
        examType: "OFFICIAL",
      }),
    ).resolves.toEqual({ eligible: true });
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
