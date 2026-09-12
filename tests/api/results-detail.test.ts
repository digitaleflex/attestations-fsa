import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findUnique: db.sessionFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { NextRequest } from "next/server";
import { GET } from "../../app/api/user/results/[id]/route";

function callResult() {
  const request = new NextRequest(
    "http://localhost/api/user/results/session-1",
  );
  return GET(request, { params: Promise.resolve({ id: "session-1" }) });
}

function stubSubmission(overrides: Record<string, unknown> = {}) {
  db.sessionFindUnique.mockResolvedValue({
    id: "session-1",
    userId: "user-1",
    status: "GRADED",
    scorePart1: 15,
    scorePart2: 10,
    scorePart3: null,
    totalScore: 25,
    internshipScore: 0,
    finalScore: 50,
    submittedAt: new Date("2026-09-01T10:00:00Z"),
    gradedAt: new Date("2026-09-02T10:00:00Z"),
    answers: {
      _customBareme: { totalMax: 50, maxPart1: 30, maxPart2: 20, maxPart3: 0 },
    },
    exam: {
      id: "exam-1",
      name: "Examen A",
      description: null,
      type: "OFFICIAL",
      status: "PUBLISHED",
      passingScore: 65,
      showResults: true,
      part1Points: 20, // ← config live différente du snapshot (30)
      part2Points: 40,
      part3Points: 40,
      totalPoints: 100,
    },
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({
    id: "user-1",
    name: "Alice",
  } as never);
});

describe("GET /api/user/results/[id] — snapshot _customBareme (#120)", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callResult();
    expect(res.status).toBe(401);
  });

  it("maxScore vient du snapshot _customBareme, pas de la config live", async () => {
    stubSubmission();
    const res = await callResult();
    expect(res.status).toBe(200);
    const body = await res.json();
    // Snapshot totalMax = 50 (pas totalPoints live = 100)
    expect(body.maxScore).toBe(50);
    // finalScore = 25/50 = 50 %
    expect(body.finalScore).toBe(50);
  });

  it("sans snapshot → fallback sur la config live de l'examen", async () => {
    stubSubmission({ answers: null });
    const res = await callResult();
    const body = await res.json();
    expect(body.maxScore).toBe(100); // totalPoints live
  });
});
