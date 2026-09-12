import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindFirst: vi.fn(),
  sessionUpdateMany: vi.fn(),
  examPartFindFirst: vi.fn(),
  examPartFindMany: vi.fn(),
  examFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: {
      findFirst: db.sessionFindFirst,
      updateMany: db.sessionUpdateMany,
    },
    examPart: {
      findFirst: db.examPartFindFirst,
      findMany: db.examPartFindMany,
    },
    exam: { findUnique: db.examFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  applyRateLimitByUser: vi.fn(),
  analyzeAnswerPattern: vi.fn(),
  logCheatingDetection: vi.fn(),
  createAuditLog: vi.fn(),
  pusherTrigger: vi.fn(),
  issueExamAttestation: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimitByUser: deps.applyRateLimitByUser,
}));
vi.mock("@/lib/anti-cheat", () => ({
  analyzeAnswerPattern: deps.analyzeAnswerPattern,
  logCheatingDetection: deps.logCheatingDetection,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/pusher", () => ({
  pusherServer: { trigger: deps.pusherTrigger },
}));
vi.mock("@/lib/attestations/issue", () => ({
  issueExamAttestation: deps.issueExamAttestation,
}));

import { POST } from "../../app/api/exams/[id]/submit/route";

function callSubmit(answers: unknown) {
  const request = new Request("http://localhost/api/exams/exam-1/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  return POST(request, { params: Promise.resolve({ id: "exam-1" }) });
}

function stubAuthorized() {
  deps.getCurrentUser.mockResolvedValue({
    id: "user-1",
    name: "Alice",
  } as never);
  deps.applyRateLimitByUser.mockResolvedValue({ allowed: true } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.analyzeAnswerPattern.mockResolvedValue({ isSuspicious: false } as never);
  deps.logCheatingDetection.mockResolvedValue(undefined as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.pusherTrigger.mockResolvedValue(undefined as never);
  deps.issueExamAttestation.mockResolvedValue({ created: true } as never);
});

describe("POST /api/exams/[id]/submit", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callSubmit({ q1: "o1" });
    expect(res.status).toBe(401);
  });

  it("400 si les réponses sont absentes", async () => {
    stubAuthorized();
    const res = await callSubmit(undefined);
    expect(res.status).toBe(400);
  });

  it("409 si la session est déjà soumise", async () => {
    stubAuthorized();
    db.sessionFindFirst.mockResolvedValueOnce({
      startedAt: new Date(Date.now() - 600_000),
      status: "COMPLETED",
    } as never);

    const res = await callSubmit({ q1: "o1" });
    expect(res.status).toBe(409);
    expect(db.sessionUpdateMany).not.toHaveBeenCalled();
  });

  it("404 si l'examen n'existe pas", async () => {
    stubAuthorized();
    db.sessionFindFirst.mockResolvedValueOnce(null as never);
    db.examPartFindFirst.mockResolvedValue(null as never);
    db.examFindUnique.mockResolvedValue(null as never);

    const res = await callSubmit({ q1: "o1" });
    expect(res.status).toBe(404);
  });

  it("201 — QCM corrigé, score + attestation (examen OFFICIEL réussi)", async () => {
    stubAuthorized();
    const startedAt = new Date(Date.now() - 600_000);
    db.sessionFindFirst
      .mockResolvedValueOnce({ startedAt, status: "IN_PROGRESS" } as never)
      .mockResolvedValueOnce({
        id: "session-1",
        status: "COMPLETED",
        scorePart1: 20,
        totalScore: 20,
        finalScore: 100,
      } as never);

    db.examPartFindFirst.mockResolvedValue({
      questions: [
        {
          id: "q1",
          options: [
            { id: "o1", isCorrect: true },
            { id: "o2", isCorrect: false },
          ],
        },
        {
          id: "q2",
          options: [
            { id: "o3", isCorrect: false },
            { id: "o4", isCorrect: true },
          ],
        },
      ],
    } as never);

    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      part1Points: 20,
      part2Points: 0,
      part3Points: 0,
      part1Enabled: true,
      part2Enabled: false,
      part3Enabled: false,
      totalPoints: 20,
      type: "OFFICIAL",
      passingScore: 65,
      formationId: "formation-1",
    } as never);

    db.examPartFindMany.mockResolvedValue([{ order: 1, type: "QCM" }] as never);
    db.sessionUpdateMany.mockResolvedValue({ count: 1 } as never);

    const res = await callSubmit({ q1: "o1", q2: "o4" });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.status).toBe("COMPLETED");
    expect(body.finalScore).toBe(100);
    expect(body.scorePart1).toBe(20);
    expect(body.maxScore).toBe(20);

    expect(db.sessionUpdateMany).toHaveBeenCalledTimes(1);
    expect(deps.createAuditLog).toHaveBeenCalledTimes(1);
    expect(deps.issueExamAttestation).toHaveBeenCalledWith("session-1");
  });

  it("PENDING_REVIEW — présence d'une partie à correction manuelle", async () => {
    stubAuthorized();
    db.sessionFindFirst
      .mockResolvedValueOnce({
        startedAt: new Date(Date.now() - 600_000),
        status: "IN_PROGRESS",
      } as never)
      .mockResolvedValueOnce({
        id: "session-1",
        status: "PENDING_REVIEW",
        scorePart1: 10,
        totalScore: 10,
        finalScore: 0,
      } as never);

    db.examPartFindFirst.mockResolvedValue({
      questions: [{ id: "q1", options: [{ id: "o1", isCorrect: true }] }],
    } as never);
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      part1Points: 20,
      part2Points: 0,
      part3Points: 0,
      part1Enabled: true,
      part2Enabled: false,
      part3Enabled: false,
      totalPoints: 20,
      type: "OFFICIAL",
      passingScore: 65,
      formationId: "formation-1",
    } as never);
    db.examPartFindMany.mockResolvedValue([
      { order: 1, type: "QCM" },
      { order: 2, type: "OPEN" },
    ] as never);
    db.sessionUpdateMany.mockResolvedValue({ count: 1 } as never);

    const res = await callSubmit({ q1: "o1" });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.status).toBe("PENDING_REVIEW");
    // Pas de note finale tant que la correction n'est pas terminée
    expect(body.finalScore).toBe(0);
    // Pas d'attestation pour un examen en attente de correction
    expect(deps.issueExamAttestation).not.toHaveBeenCalled();
  });

  it("parties multiples — max dérivé des ExamPart réels (2 QCM + OPEN)", async () => {
    stubAuthorized();
    db.sessionFindFirst
      .mockResolvedValueOnce({
        startedAt: new Date(Date.now() - 600_000),
        status: "IN_PROGRESS",
      } as never)
      .mockResolvedValueOnce({
        id: "session-1",
        status: "PENDING_REVIEW",
        scorePart1: 20,
        totalScore: 20,
        finalScore: 0,
      } as never);

    // Première partie QCM (order 1) : 20 pts — c'est elle qui est notée
    db.examPartFindFirst.mockResolvedValue({
      points: 20,
      questions: [{ id: "q1", options: [{ id: "o1", isCorrect: true }] }],
    } as never);
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      part1Points: 20, // legacy : première QCM seulement
      part2Points: 50, // legacy : première OPEN seulement
      part3Points: 0,
      part1Enabled: true,
      part2Enabled: true,
      part3Enabled: false,
      totalPoints: 100,
      type: "OFFICIAL",
      passingScore: 65,
      formationId: "formation-1",
    } as never);
    // 2 parties QCM (20+30) + 1 OPEN (50) → max réel = 100
    db.examPartFindMany.mockResolvedValue([
      { order: 1, type: "QCM", points: 20 },
      { order: 2, type: "QCM", points: 30 },
      { order: 3, type: "OPEN", points: 50 },
    ] as never);
    db.sessionUpdateMany.mockResolvedValue({ count: 1 } as never);

    const res = await callSubmit({ q1: "o1" });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.status).toBe("PENDING_REVIEW");
    // maxScore = 100 (somme des ExamPart réels), pas 70 (legacy 20+50)
    expect(body.maxScore).toBe(100);
    expect(body.scorePart1).toBe(20);
  });
});
