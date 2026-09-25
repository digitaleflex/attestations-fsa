import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  enrollmentUpsert: vi.fn(),
  enrollmentUpdateMany: vi.fn(),
  enrollmentFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examEnrollment: {
      upsert: db.enrollmentUpsert,
      updateMany: db.enrollmentUpdateMany,
      findUnique: db.enrollmentFindUnique,
    },
  },
}));

import {
  ENROLLMENT_ACTIVE,
  ENROLLMENT_REVOKED,
  grantExamEnrollment,
  isEnrollmentStatus,
  revokeExamEnrollment,
} from "@/lib/exams/enrollment";

const NOW = new Date("2026-09-25T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  db.enrollmentUpsert.mockResolvedValue({
    id: "enrollment-1",
    status: "ACTIVE",
    createdAt: NOW,
  });
  db.enrollmentUpdateMany.mockResolvedValue({ count: 1 });
  db.enrollmentFindUnique.mockResolvedValue({
    id: "enrollment-1",
    status: "REVOKED",
  });
});

describe("grantExamEnrollment", () => {
  it("crée une inscription ACTIVE sur la clé unique (userId, examId)", async () => {
    const result = await grantExamEnrollment({
      userId: "user-1",
      examId: "exam-1",
      grantedById: "admin-1",
      now: NOW,
    });

    expect(db.enrollmentUpsert).toHaveBeenCalledTimes(1);
    const args = db.enrollmentUpsert.mock.calls[0][0];
    expect(args.where).toEqual({
      userId_examId: { userId: "user-1", examId: "exam-1" },
    });
    expect(args.create).toMatchObject({
      userId: "user-1",
      examId: "exam-1",
      status: ENROLLMENT_ACTIVE,
      source: "ADMIN_ASSIGNMENT",
      grantedById: "admin-1",
    });
    expect(result).toMatchObject({ id: "enrollment-1", status: ENROLLMENT_ACTIVE });
  });

  // Idempotence : un rejeu de la même affectation repasse par l'upsert, donc
  // ne peut pas créer une deuxième ligne (contrainte @@unique(userId, examId)).
  it("est idempotent : deux appels ne créent qu'une ligne", async () => {
    await grantExamEnrollment({ userId: "user-1", examId: "exam-1", now: NOW });
    db.enrollmentUpsert.mockResolvedValue({
      id: "enrollment-1",
      status: "ACTIVE",
      // 2e appel : la ligne existe déjà (createdAt antérieur) → pas une création.
      createdAt: new Date("2026-09-01T09:00:00.000Z"),
    });
    const replay = await grantExamEnrollment({
      userId: "user-1",
      examId: "exam-1",
      now: NOW,
    });

    expect(db.enrollmentUpsert).toHaveBeenCalledTimes(2);
    expect(replay.created).toBe(false);
    expect(replay.status).toBe(ENROLLMENT_ACTIVE);
  });

  it("réactive une inscription révoquée en effaçant la révocation", async () => {
    await grantExamEnrollment({ userId: "user-1", examId: "exam-1", now: NOW });

    const args = db.enrollmentUpsert.mock.calls[0][0];
    expect(args.update).toMatchObject({
      status: ENROLLMENT_ACTIVE,
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
    });
  });

  it("refuse un identifiant vide plutôt que d'écrire une ligne orpheline", async () => {
    await expect(
      grantExamEnrollment({ userId: "  ", examId: "exam-1" }),
    ).rejects.toThrow(/obligatoires/);
    await expect(
      grantExamEnrollment({ userId: "user-1", examId: "" }),
    ).rejects.toThrow(/obligatoires/);
    expect(db.enrollmentUpsert).not.toHaveBeenCalled();
  });

  it("borne et normalise les champs de suivi saisis", async () => {
    await grantExamEnrollment({
      userId: "user-1",
      examId: "exam-1",
      source: "  IMPORT  ",
      note: "n".repeat(900),
      grantedById: "admin-1",
      now: NOW,
    });

    const args = db.enrollmentUpsert.mock.calls[0][0];
    expect(args.create.source).toBe("IMPORT");
    expect(args.create.note).toHaveLength(500);
  });

  it("utilise le client fourni (transaction appelante)", async () => {
    const tx = {
      examEnrollment: {
        upsert: vi.fn().mockResolvedValue({
          id: "enrollment-2",
          status: "ACTIVE",
          createdAt: NOW,
        }),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };

    await grantExamEnrollment({
      userId: "user-1",
      examId: "exam-1",
      client: tx,
      now: NOW,
    });

    expect(tx.examEnrollment.upsert).toHaveBeenCalledTimes(1);
    expect(db.enrollmentUpsert).not.toHaveBeenCalled();
  });

  it("traite un statut renvoyé inconnu comme ACTIVE sans lever", async () => {
    db.enrollmentUpsert.mockResolvedValue({
      id: "enrollment-1",
      status: "PEUT-ETRE",
      createdAt: NOW,
    });

    await expect(
      grantExamEnrollment({ userId: "user-1", examId: "exam-1", now: NOW }),
    ).resolves.toMatchObject({ status: ENROLLMENT_ACTIVE });
  });
});

describe("revokeExamEnrollment", () => {
  it("révoque logiquement sans supprimer la ligne", async () => {
    const result = await revokeExamEnrollment({
      userId: "user-1",
      examId: "exam-1",
      revokedById: "admin-1",
      revokeReason: "retrait de l'affectation",
      now: NOW,
    });

    const args = db.enrollmentUpdateMany.mock.calls[0][0];
    expect(args.where).toEqual({
      userId: "user-1",
      examId: "exam-1",
      // Le garde-fou `status: ACTIVE` rend l'opération idempotente : un
      // second appel ne peut pas réécrire la date de révocation.
      status: ENROLLMENT_ACTIVE,
    });
    expect(args.data).toMatchObject({
      status: ENROLLMENT_REVOKED,
      revokedAt: NOW,
      revokedById: "admin-1",
      revokeReason: "retrait de l'affectation",
    });
    expect(result).toEqual({ id: null, changed: true });
    // Jamais de DELETE physique : l'historique reste lisible.
    expect(db.enrollmentUpsert).not.toHaveBeenCalled();
  });

  it("est idempotent : une révoquer déjà révoquée ne lève pas", async () => {
    db.enrollmentUpdateMany.mockResolvedValue({ count: 0 });

    const result = await revokeExamEnrollment({
      userId: "user-1",
      examId: "exam-1",
      now: NOW,
    });

    expect(result).toEqual({ id: "enrollment-1", changed: false });
    expect(db.enrollmentUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("reste idempotent sur une inscription jamais accordée", async () => {
    db.enrollmentUpdateMany.mockResolvedValue({ count: 0 });
    db.enrollmentFindUnique.mockResolvedValue(null);

    await expect(
      revokeExamEnrollment({ userId: "user-1", examId: "exam-1", now: NOW }),
    ).resolves.toEqual({ id: null, changed: false });
  });

  it("refuse un identifiant vide", async () => {
    await expect(
      revokeExamEnrollment({ userId: "user-1", examId: "" }),
    ).rejects.toThrow(/obligatoires/);
    expect(db.enrollmentUpdateMany).not.toHaveBeenCalled();
  });
});

describe("isEnrollmentStatus", () => {
  it("n'accepte que les deux statuts documentés", () => {
    expect(isEnrollmentStatus("ACTIVE")).toBe(true);
    expect(isEnrollmentStatus("REVOKED")).toBe(true);
    expect(isEnrollmentStatus("active")).toBe(false);
    expect(isEnrollmentStatus("SUPPRIME")).toBe(false);
    expect(isEnrollmentStatus(undefined)).toBe(false);
    expect(isEnrollmentStatus(42)).toBe(false);
  });
});
