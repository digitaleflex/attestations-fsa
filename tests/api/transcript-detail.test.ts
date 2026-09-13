import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findUnique: db.sessionFindUnique },
    user: { findUnique: db.userFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { GET } from "../../app/api/user/transcript/[sessionId]/route";

function callTranscript() {
  const request = new Request("http://localhost/api/user/transcript/session-1");
  return GET(request, { params: Promise.resolve({ sessionId: "session-1" }) });
}

function stubSession(overrides: Record<string, unknown> = {}) {
  db.sessionFindUnique.mockResolvedValue({
    id: "session-1",
    userId: "user-1",
    status: "COMPLETED",
    scorePart1: 18,
    scorePart2: null,
    scorePart3: null,
    totalScore: 18,
    internshipScore: 0,
    finalScore: 90,
    submittedAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
    answers: null,
    exam: {
      title: "Examen A",
      totalPoints: 20,
      part1Points: 20,
      part2Points: 0,
      part3Points: 0,
      part1Enabled: true,
      part2Enabled: false,
      part3Enabled: false,
      passingScore: 65,
      showResults: true,
    },
    candidate: { name: "Alice" },
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({
    id: "user-1",
    name: "Alice",
  } as never);
  db.userFindUnique.mockResolvedValue({
    id: "user-1",
    formation: { name: "Formation Test" },
  } as never);
});

describe("GET /api/user/transcript/[sessionId] (#135/#122)", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callTranscript();
    expect(res.status).toBe(401);
  });

  it("isolation des données : session d'un autre user → 403", async () => {
    stubSession({ userId: "user-2" });
    const res = await callTranscript();
    expect(res.status).toBe(403);
  });

  it("session non corrigée → 400", async () => {
    stubSession({ status: "IN_PROGRESS" });
    const res = await callTranscript();
    expect(res.status).toBe(400);
  });

  it("showResults=true → notes exposées", async () => {
    stubSession();
    const res = await callTranscript();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.finalScore).toBe(90);
    expect(body.passed).toBe(true);
    expect(body.scorePart1).toBe(18);
  });

  it("showResults=false → notes masquées (#122)", async () => {
    stubSession({
      exam: {
        title: "Examen A",
        totalPoints: 20,
        part1Points: 20,
        part2Points: 0,
        part3Points: 0,
        part1Enabled: true,
        part2Enabled: false,
        part3Enabled: false,
        passingScore: 65,
        showResults: false,
      },
    });
    const res = await callTranscript();
    const body = await res.json();
    expect(body.finalScore).toBeNull();
    expect(body.passed).toBeNull();
    expect(body.scorePart1).toBeNull();
    expect(body.totalScore).toBeNull();
  });
});
