import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  formationFindUnique: vi.fn(),
  examCreate: vi.fn(),
  examPartCreateMany: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { findUnique: db.formationFindUnique },
    exam: { create: db.examCreate },
    examPart: { createMany: db.examPartCreateMany },
    auditLog: { create: db.auditLogCreate },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { POST } from "../../../app/api/admin/exams/route";

function callCreate(passingScore?: number) {
  const body: Record<string, unknown> = {
    name: "Examen test",
    formationId: "formation-1",
    duration: 3600,
    randomizeQuestions: false,
    showResults: false,
    status: "DRAFT",
    parts: [
      {
        title: "QCM",
        type: "QCM",
        points: 20,
        order: 1,
        enabled: true,
        questions: [
          {
            text: "Q1",
            type: "SINGLE_CHOICE",
            points: 1,
            options: [{ text: "A", isCorrect: true }],
          },
        ],
      },
    ],
  };
  if (passingScore !== undefined) body.passingScore = passingScore;
  const request = new Request("http://localhost/api/admin/exams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({
    id: "admin-1",
    role: "ADMIN",
  } as never);
  db.formationFindUnique.mockResolvedValue({ id: "formation-1" } as never);
  db.examCreate.mockResolvedValue({ id: "exam-1" } as never);
  db.examPartCreateMany.mockResolvedValue({ count: 1 } as never);
  db.auditLogCreate.mockResolvedValue(undefined as never);
});

describe("POST /api/admin/exams — passingScore (#123)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callCreate();
    expect(res.status).toBe(401);
  });

  it("arrondit un seuil fractionnaire (62.5 → 63) au lieu d'échouer", async () => {
    const res = await callCreate(62.5);
    expect(res.status).toBe(201);
    expect(db.examCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passingScore: 63 }),
      }),
    );
  });

  it("défaut = 65 quand passingScore absent", async () => {
    const res = await callCreate();
    expect(res.status).toBe(201);
    expect(db.examCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passingScore: 65 }),
      }),
    );
  });

  it("garde un entier tel quel (70 → 70)", async () => {
    const res = await callCreate(70);
    expect(res.status).toBe(201);
    expect(db.examCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passingScore: 70 }),
      }),
    );
  });
});
