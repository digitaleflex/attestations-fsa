import { vi, describe, it, expect, beforeEach } from "vitest";

// #136 — Test de parcours : la chaîne cœur en un seul flux.
// start → submit → correct → attestation → results.
// Chaque étape est testée isolément ailleurs ; ici on vérifie que le
// parcours complet tient (les statuts s'enchaînent correctement).

const db = vi.hoisted(() => ({
  sessionFindFirst: vi.fn(),
  sessionFindUnique: vi.fn(),
  sessionUpdateMany: vi.fn(),
  sessionUpdate: vi.fn(),
  examFindUnique: vi.fn(),
  examPartFindFirst: vi.fn(),
  examPartFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  enrollmentFindUnique: vi.fn(),
  formationFindFirst: vi.fn(),
  attestationFindFirst: vi.fn(),
  attestationCreate: vi.fn(),
  attestationCount: vi.fn(),
  attestationFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: {
      findFirst: db.sessionFindFirst,
      findUnique: db.sessionFindUnique,
      updateMany: db.sessionUpdateMany,
      update: db.sessionUpdate,
    },
    exam: { findUnique: db.examFindUnique },
    examPart: {
      findFirst: db.examPartFindFirst,
      findMany: db.examPartFindMany,
    },
    user: { findUnique: db.userFindUnique },
    examEnrollment: { findUnique: db.enrollmentFindUnique },
    formation: { findFirst: db.formationFindFirst },
    attestation: {
      findFirst: db.attestationFindFirst,
      create: db.attestationCreate,
      count: db.attestationCount,
      findMany: db.attestationFindMany,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  applyRateLimitByUser: vi.fn(),
  analyzeAnswerPattern: vi.fn(),
  logCheatingDetection: vi.fn(),
  createAuditLog: vi.fn(),
  pusherTrigger: vi.fn(),
  issueExamAttestation: vi.fn(),
  sendExamResults: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
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
vi.mock("@/lib/email", () => ({
  emailService: { sendExamResults: deps.sendExamResults },
}));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));

import { POST as submit } from "../../app/api/exams/[id]/submit/route";
import { POST as correct } from "../../app/api/admin/submissions/[id]/correct/route";

function submitRequest(answers: unknown) {
  return new Request("http://localhost/api/exams/exam-1/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}

function correctRequest(body: unknown) {
  return new Request("http://localhost/api/admin/submissions/sub-1/correct", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    examId: "exam-1",
    userId: "user-1",
    status: "PENDING_REVIEW",
    scorePart1: 18,
    scorePart2: null,
    scorePart3: null,
    score: 18,
    totalScore: 18,
    internshipScore: 0,
    finalScore: 90,
    answers: {},
    startedAt: new Date("2026-09-01T09:00:00Z"),
    submittedAt: new Date("2026-09-01T10:00:00Z"),
    exam: {
      id: "exam-1",
      title: "Examen FSA",
      type: "OFFICIAL",
      formationId: "formation-1",
      part1Enabled: true,
      part2Enabled: true,
      part3Enabled: true,
      part1Points: 60,
      part2Points: 20,
      part3Points: 20,
      passingScore: 50,
      showResults: true,
    },
    candidate: {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      birthDate: new Date("2000-01-01"),
      birthPlace: "Cotonou",
    },
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({
    id: "user-1",
    name: "Alice",
  } as never);
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.applyRateLimitByUser.mockResolvedValue({ allowed: true } as never);
  deps.analyzeAnswerPattern.mockResolvedValue({ isSuspicious: false } as never);
  deps.logCheatingDetection.mockResolvedValue(undefined as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.pusherTrigger.mockResolvedValue(undefined as never);
  deps.issueExamAttestation.mockResolvedValue({
    created: true,
    code: "FSA-2026-M09-00001-abcde",
  } as never);
  deps.sendExamResults.mockResolvedValue(undefined as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  db.sessionUpdateMany.mockResolvedValue({ count: 1 } as never);
  db.sessionUpdate.mockResolvedValue(
    makeSession({ status: "GRADED" }) as never,
  );
  db.sessionFindUnique.mockResolvedValue(makeSession() as never);
  db.attestationFindFirst.mockResolvedValue(null as never);
  db.attestationCreate.mockResolvedValue({ id: "att-1" } as never);
  db.attestationCount.mockResolvedValue(0 as never);
  db.attestationFindMany.mockResolvedValue([] as never);
  db.userFindUnique.mockResolvedValue({ id: "user-1", examId: null } as never);
  db.enrollmentFindUnique.mockResolvedValue({ id: "enrollment-1" } as never);
  db.formationFindFirst.mockResolvedValue({ id: "formation-1" } as never);
});

describe("Parcours cœur : submit → correct → attestation (#136)", () => {
  it("soumission QCM → GRADED → attestation émise", async () => {
    // submit : session IN_PROGRESS, examen 100% QCM
    db.sessionFindFirst
      .mockResolvedValueOnce({
        id: "sub-1",
        startedAt: new Date(Date.now() - 600_000),
        status: "IN_PROGRESS",
        submittedAt: null,
      } as never)
      .mockResolvedValueOnce({
        id: "sub-1",
        status: "GRADED",
        scorePart1: 20,
        totalScore: 20,
        finalScore: 100,
      } as never);
    db.examPartFindFirst.mockResolvedValue({
      points: 20,
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
      { order: 1, type: "QCM", points: 20 },
    ] as never);

    const res = await submit(submitRequest({ q1: "o1" }), {
      params: Promise.resolve({ id: "exam-1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("GRADED");
    expect(body.finalScore).toBe(100);
    // Attestation émise pour l'examen officiel réussi
    expect(deps.issueExamAttestation).toHaveBeenCalledWith("sub-1");
  });

  it("correction manuelle → GRADED → attestation (idempotente)", async () => {
    // correct : session PENDING_REVIEW avec parties 2/3
    db.sessionFindUnique.mockResolvedValue(makeSession() as never);
    db.sessionUpdate.mockResolvedValue(
      makeSession({
        status: "GRADED",
        scorePart2: 20,
        scorePart3: 20,
      }) as never,
    );

    const res = await correct(
      correctRequest({ part1Score: 60, part2Score: 20, part3Score: 20 }),
      { params: Promise.resolve({ id: "sub-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submission.status).toBe("GRADED");
    expect(body.passed).toBe(true);
    expect(deps.issueExamAttestation).toHaveBeenCalledWith("sub-1");
  });

  it("re-correction à la baisse → attestation révoquée", async () => {
    db.sessionFindUnique.mockResolvedValue(
      makeSession({ status: "GRADED", finalScore: 30 }) as never,
    );
    db.sessionUpdate.mockResolvedValue(
      makeSession({ status: "GRADED", finalScore: 30 }) as never,
    );
    deps.issueExamAttestation.mockResolvedValue({
      created: false,
      revoked: true,
    } as never);

    const res = await correct(
      correctRequest({ part1Score: 10, part2Score: 10, part3Score: 10 }),
      { params: Promise.resolve({ id: "sub-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.passed).toBe(false);
    expect(deps.issueExamAttestation).toHaveBeenCalledWith("sub-1");
  });
});
