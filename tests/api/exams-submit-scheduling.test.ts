/**
 * Non-régression — soumission et re-verrouillage d'un examen.
 *
 * Spécification : docs/specs/2026-09-25-exam-scheduling-design.md
 *   - « `draft` et `submit` revérifient la disponibilité à chaque requête » ;
 *   - « `submit` refuse un examen archivé ou redeployé verrouillé » ;
 *   - une session déjà commencée peut être reprise selon les règles existantes.
 *
 * Complète `tests/api/exams-submit.test.ts` (validation des réponses, score,
 * anti-double-soumission), qui reste inchangé.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examFindUnique: vi.fn(),
  examPartFindFirst: vi.fn(),
  examPartFindMany: vi.fn(),
  sessionFindFirst: vi.fn(),
  sessionUpdateMany: vi.fn(),
  enrollmentFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: { findUnique: db.examFindUnique },
    examPart: {
      findFirst: db.examPartFindFirst,
      findMany: db.examPartFindMany,
    },
    examSession: {
      findFirst: db.sessionFindFirst,
      updateMany: db.sessionUpdateMany,
    },
    examEnrollment: { findUnique: db.enrollmentFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  applyRateLimitByUser: vi.fn(),
  createAuditLog: vi.fn(),
  issueExamAttestation: vi.fn(),
  deleteDraft: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimitByUser: deps.applyRateLimitByUser,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/attestations/issue", () => ({
  issueExamAttestation: deps.issueExamAttestation,
}));
vi.mock("@/lib/exam-draft", () => ({ deleteDraft: deps.deleteDraft }));

import { POST } from "../../app/api/exams/[id]/submit/route";

const params = { params: Promise.resolve({ id: "exam-1" }) };

/** J = 2099-01-01 (local Africa/Porto-Novo). */
const FUTURE_OPENS_ON = new Date("2098-12-31T23:00:00Z");
const FUTURE_SCHEDULED_AT = new Date("2099-01-01T07:00:00Z");

function callSubmit(answers: unknown = { q1: "o1" }) {
  return POST(
    new Request("http://localhost/api/exams/exam-1/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    }),
    params,
  );
}

/** Examen ouvert, corrigé au QCM seul, sans formation (pas d'attestation). */
function openExam(overrides: Record<string, unknown> = {}) {
  return {
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
    formationId: null,
    duration: 3600,
    status: "PUBLISHED",
    opensOn: new Date(Date.now() - 86_400_000),
    scheduledAt: new Date(Date.now() - 3_600_000),
    ...overrides,
  };
}

function stubStartedSession() {
  db.sessionFindFirst.mockResolvedValue({
    id: "session-1",
    startedAt: new Date(Date.now() - 60_000),
    status: "IN_PROGRESS",
    submittedAt: null,
  } as never);
  db.examPartFindFirst.mockResolvedValue({
    points: 20,
    questions: [
      {
        id: "q1",
        type: "SINGLE_CHOICE",
        options: [{ id: "o1", isCorrect: true }],
      },
    ],
  } as never);
  db.examPartFindMany.mockResolvedValue([
    {
      id: "part-1",
      type: "QCM",
      points: 20,
      questions: [
        {
          id: "q1",
          type: "SINGLE_CHOICE",
          options: [{ id: "o1", isCorrect: true }],
        },
      ],
    },
  ] as never);
  db.sessionUpdateMany.mockResolvedValue({ count: 1 } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  deps.getAdminUser.mockResolvedValue(null as never);
  deps.applyRateLimitByUser.mockResolvedValue({ allowed: true } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.issueExamAttestation.mockResolvedValue({ created: false } as never);
  deps.deleteDraft.mockResolvedValue(true as never);
  db.enrollmentFindUnique.mockResolvedValue({
    id: "enrollment-1",
    status: "ACTIVE",
  } as never);
  db.examFindUnique.mockResolvedValue(openExam() as never);
  stubStartedSession();
});

describe("POST /api/exams/[id]/submit — examen redeployé verrouillé", () => {
  it("refuse la soumission si l'examen a été repoussé dans le futur", async () => {
    db.examFindUnique.mockResolvedValue(
      openExam({
        status: "SCHEDULED",
        opensOn: FUTURE_OPENS_ON,
        scheduledAt: FUTURE_SCHEDULED_AT,
      }) as never,
    );
    const res = await callSubmit();
    expect([403, 409, 423]).toContain(res.status);
  });

  it("aucune session n'est close, aucune attestation émise", async () => {
    db.examFindUnique.mockResolvedValue(
      openExam({
        status: "SCHEDULED",
        opensOn: FUTURE_OPENS_ON,
        scheduledAt: FUTURE_SCHEDULED_AT,
      }) as never,
    );
    await callSubmit();
    expect(db.sessionUpdateMany).not.toHaveBeenCalled();
    expect(deps.issueExamAttestation).not.toHaveBeenCalled();
    expect(deps.createAuditLog).not.toHaveBeenCalled();
  });

  it("refuse la soumission si l'examen est ARCHIVED", async () => {
    db.examFindUnique.mockResolvedValue(
      openExam({
        status: "ARCHIVED",
        opensOn: new Date(Date.now() - 86_400_000),
        scheduledAt: new Date(Date.now() - 86_400_000),
      }) as never,
    );
    const res = await callSubmit();
    expect([403, 409, 423]).toContain(res.status);
    expect(db.sessionUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse la soumission le jour J avant l'heure prévue", async () => {
    db.examFindUnique.mockResolvedValue(
      openExam({
        status: "SCHEDULED",
        opensOn: new Date(Date.now() - 3_600_000),
        scheduledAt: new Date(Date.now() + 3_600_000),
      }) as never,
    );
    const res = await callSubmit();
    expect([403, 409, 423]).toContain(res.status);
    expect(db.sessionUpdateMany).not.toHaveBeenCalled();
  });

  it("un examen redeployé ne peut pas non plus être remis à zéro", async () => {
    db.examFindUnique.mockResolvedValue(
      openExam({
        status: "SCHEDULED",
        opensOn: FUTURE_OPENS_ON,
        scheduledAt: FUTURE_SCHEDULED_AT,
      }) as never,
    );
    // Une session déjà soumise reste refusée : le verrou ne rend pas la
    // route plus permissive qu'avant.
    db.sessionFindFirst.mockResolvedValue({
      id: "session-1",
      startedAt: new Date(Date.now() - 86_400_000),
      status: "GRADED",
      submittedAt: new Date(),
    } as never);
    const res = await callSubmit();
    expect(res.status).not.toBe(200);
    expect(db.sessionUpdateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/exams/[id]/submit — session reprise après ouverture", () => {
  it("accepte la soumission d'une session déjà commencée", async () => {
    const res = await callSubmit();
    expect(res.status).toBe(201);
    expect(db.sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "session-1" }),
      }),
    );
  });

  it("supprime le brouillon associé après soumission", async () => {
    await callSubmit();
    expect(deps.deleteDraft).toHaveBeenCalledWith("exam-1", "user-1");
  });

  it("404 pour un examen inexistant (jamais un refus de planning)", async () => {
    db.examFindUnique.mockResolvedValue(null as never);
    const res = await callSubmit();
    expect(res.status).toBe(404);
  });

  it("409 si aucune session n'a été démarrée", async () => {
    db.sessionFindFirst.mockResolvedValue(null as never);
    const res = await callSubmit();
    expect(res.status).toBe(409);
  });
});
