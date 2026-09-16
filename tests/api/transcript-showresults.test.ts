import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  attestationFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findMany: db.sessionFindMany },
    user: { findUnique: db.userFindUnique },
    attestation: { findMany: db.attestationFindMany },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { GET } from "../../app/api/user/transcript/route";

function callTranscript() {
  const request = new Request("http://localhost/api/user/transcript");
  return GET(request);
}

function stubSession(overrides: Record<string, unknown> = {}) {
  db.sessionFindMany.mockResolvedValue([
    {
      id: "session-1",
      status: "COMPLETED",
      scorePart1: 18,
      scorePart2: null,
      scorePart3: null,
      totalScore: 18,
      internshipScore: 0,
      finalScore: 90,
      submittedAt: new Date("2026-09-01T10:00:00Z"),
      startedAt: new Date("2026-09-01T09:00:00Z"),
      transcriptDownloadedAt: null,
      answers: null,
      exam: {
        name: "Examen A",
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
        type: "OFFICIAL",
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
  db.userFindUnique.mockResolvedValue({
    id: "user-1",
    formation: { name: "Formation Test" },
  } as never);
  db.attestationFindMany.mockResolvedValue([] as never);
});

describe("GET /api/user/transcript — showResults (#122)", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callTranscript();
    expect(res.status).toBe(401);
  });

  it("showResults=true → notes exposées", async () => {
    stubSession();
    const res = await callTranscript();
    expect(res.status).toBe(200);
    const body = await res.json();
    const r = body.examResults[0];
    expect(r.finalScore).toBe(90);
    expect(r.passed).toBe(true);
    expect(r.part1Score).toBe(18);
    expect(r.totalScore).toBe(18);
  });

  it("showResults=false → notes masquées (finalScore/passed/part1Score null)", async () => {
    stubSession({
      exam: {
        name: "Examen A",
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
        type: "OFFICIAL",
      },
    });
    const res = await callTranscript();
    expect(res.status).toBe(200);
    const body = await res.json();
    const r = body.examResults[0];
    expect(r.finalScore).toBeNull();
    expect(r.passed).toBeNull();
    expect(r.part1Score).toBeNull();
    expect(r.totalScore).toBeNull();
    expect(r.internshipScore).toBeNull();
    // Le barème reste visible (pas une note)
    expect(r.totalPoints).toBe(20);
    expect(r.passingScore).toBe(65);
  });

  it("session non corrigée (IN_PROGRESS) → finalScore null même si showResults=true", async () => {
    stubSession({ status: "IN_PROGRESS", finalScore: 0 });
    const res = await callTranscript();
    const body = await res.json();
    const r = body.examResults[0];
    expect(r.finalScore).toBeNull();
  });
});
