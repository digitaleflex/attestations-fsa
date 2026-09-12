import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: { create: db.examCreate },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  getCurrentUser: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAdminUser: deps.getAdminUser,
  getCurrentUser: deps.getCurrentUser,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { NextRequest } from "next/server";
import { POST } from "../../app/api/exams/route";

function callCreate() {
  const request = new NextRequest("http://localhost/api/exams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Examen legacy",
      description: "Test",
      status: "DRAFT",
      type: "OFFICIAL",
      parts: [
        {
          title: "QCM",
          type: "QCM",
          points: 30,
          order: 1,
          duration: 30,
          questions: [],
        },
        {
          title: "QCM2",
          type: "QCM",
          points: 20,
          order: 2,
          duration: 30,
          questions: [],
        },
        {
          title: "Rédaction",
          type: "OPEN",
          points: 50,
          order: 3,
          duration: 60,
          questions: [],
        },
      ],
    }),
  });
  return POST(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({
    id: "admin-1",
    role: "ADMIN",
  } as never);
  deps.getCurrentUser.mockResolvedValue({
    id: "admin-1",
    role: "ADMIN",
  } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.examCreate.mockResolvedValue({ id: "exam-1" } as never);
});

describe("POST /api/exams (legacy) — barème depuis les parts m5 (#130)", () => {
  it("partNPoints = somme des parts du type (pas 20/40/40 par défaut)", async () => {
    const res = await callCreate();
    expect(res.status).toBe(201);
    expect(db.examCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          part1Points: 50, // 30 + 20 (2 QCM)
          part2Points: 50, // 1 OPEN
          part3Points: 0,
          totalPoints: 100,
          part1Enabled: true,
          part2Enabled: true,
          part3Enabled: false,
        }),
      }),
    );
  });
});
