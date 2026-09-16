import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findMany: db.sessionFindMany },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { GET } from "../../app/api/user/results/route";

function callResults() {
  const request = new Request("http://localhost/api/user/results");
  return GET(request);
}

function stubSubmission(overrides: Record<string, unknown> = {}) {
  db.sessionFindMany.mockResolvedValue([
    {
      id: "session-1",
      examId: "exam-1",
      userId: "user-1",
      status: "COMPLETED",
      scorePart1: 18,
      scorePart2: null,
      scorePart3: null,
      totalScore: 18,
      internshipScore: 15,
      finalScore: 90,
      submittedAt: new Date("2026-09-01T10:00:00Z"),
      gradedAt: null,
      answers: null,
      exam: {
        id: "exam-1",
        name: "Examen A",
        description: null,
        type: "OFFICIAL",
        passingScore: 65,
        showResults: true,
        part1Points: 20,
        part2Points: 0,
        part3Points: 0,
        part1Enabled: true,
        part2Enabled: false,
        part3Enabled: false,
        totalPoints: 20,
      },
      ...overrides,
    },
  ] as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({
    id: "user-1",
    name: "Alice",
  } as never);
});

describe("GET /api/user/results — masquage m2 (#130)", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callResults();
    expect(res.status).toBe(401);
  });

  it("showResults=true → internshipScore et passed exposés", async () => {
    stubSubmission();
    const res = await callResults();
    const body = await res.json();
    const r = body.results[0];
    expect(r.internshipScore).toBe(15);
    expect(r.passed).toBe(true);
  });

  it("showResults=false → internshipScore et passed masqués (null)", async () => {
    stubSubmission({
      exam: {
        id: "exam-1",
        name: "Examen A",
        description: null,
        type: "OFFICIAL",
        passingScore: 65,
        showResults: false,
        part1Points: 20,
        part2Points: 0,
        part3Points: 0,
        part1Enabled: true,
        part2Enabled: false,
        part3Enabled: false,
        totalPoints: 20,
      },
    });
    const res = await callResults();
    const body = await res.json();
    const r = body.results[0];
    expect(r.internshipScore).toBeNull();
    expect(r.passed).toBeNull();
    expect(r.finalScore).toBeNull();
    expect(r.scorePart1).toBeNull();
  });
});
