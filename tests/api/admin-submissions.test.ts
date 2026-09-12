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
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET } from "../../app/api/admin/submissions/route";

function callSubmissions() {
  const request = new Request("http://localhost/api/admin/submissions");
  return GET(request);
}

function stubSubmission(status: string, finalScore: number, passingScore = 65) {
  db.sessionFindMany.mockResolvedValue([
    {
      id: "session-1",
      status,
      finalScore,
      totalScore: 18,
      scorePart1: 18,
      startedAt: new Date(),
      submittedAt: new Date(),
      candidate: { id: "user-1", name: "Alice", email: "a@b.c" },
      exam: {
        id: "exam-1",
        name: "Examen A",
        description: null,
        type: "OFFICIAL",
        totalPoints: 20,
        part1Points: 20,
        part2Points: 0,
        part3Points: 0,
        part1Enabled: true,
        part2Enabled: false,
        part3Enabled: false,
        passingScore,
        showResults: true,
      },
    },
  ] as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({
    id: "admin-1",
    role: "ADMIN",
  } as never);
});

describe("GET /api/admin/submissions — corrigé = COMPLETED || GRADED (#125)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callSubmissions();
    expect(res.status).toBe(401);
  });

  it("COMPLETED (auto-corrigé) → completed=true et passed correct", async () => {
    stubSubmission("COMPLETED", 90);
    const res = await callSubmissions();
    expect(res.status).toBe(200);
    const body = await res.json();
    const s = body.submissions[0];
    expect(s.completed).toBe(true);
    expect(s.passed).toBe(true);
    expect(body.stats.completed).toBe(1);
  });

  it("COMPLETED sous le seuil → completed=true mais passed=false", async () => {
    stubSubmission("COMPLETED", 50);
    const res = await callSubmissions();
    const body = await res.json();
    const s = body.submissions[0];
    expect(s.completed).toBe(true);
    expect(s.passed).toBe(false);
  });

  it("GRADED → toujours corrigé", async () => {
    stubSubmission("GRADED", 80);
    const res = await callSubmissions();
    const body = await res.json();
    const s = body.submissions[0];
    expect(s.completed).toBe(true);
    expect(s.passed).toBe(true);
  });

  it("IN_PROGRESS → non corrigé", async () => {
    stubSubmission("IN_PROGRESS", 0);
    const res = await callSubmissions();
    const body = await res.json();
    const s = body.submissions[0];
    expect(s.completed).toBe(false);
    expect(s.passed).toBe(false);
  });
});
