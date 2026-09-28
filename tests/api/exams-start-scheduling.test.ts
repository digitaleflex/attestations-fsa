/**
 * Non-régression — POST /api/exams/[id]/start et ouverture planifiée.
 *
 * Spécification : docs/specs/2026-09-25-exam-scheduling-design.md
 *   - `start` devient autorisé uniquement si l'examen est `ACTIVE`/publié et
 *     si `scheduledAt <= now` ;
 *   - avant le jour J, `start` refuse avec `423 EXAM_LOCKED` ;
 *   - « Le lazy-open reste un filet de sécurité interne, sans mutation depuis
 *     une route publique » → une route publique ne bascule PLUS le statut.
 *
 * Complète `tests/api/exams-start.test.ts` (guards d'inscription / sessions),
 * qui reste inchangé.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examFindUnique: vi.fn(),
  examUpdate: vi.fn(),
  examUpdateMany: vi.fn(),
  userFindUnique: vi.fn(),
  sessionFindFirst: vi.fn(),
  sessionUpsert: vi.fn(),
  enrollmentFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: {
      findUnique: db.examFindUnique,
      update: db.examUpdate,
      updateMany: db.examUpdateMany,
    },
    user: { findUnique: db.userFindUnique },
    examEnrollment: { findUnique: db.enrollmentFindUnique },
    examSession: {
      findFirst: db.sessionFindFirst,
      upsert: db.sessionUpsert,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
  applyRateLimitByUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimitByUser: deps.applyRateLimitByUser,
}));

import { POST } from "../../app/api/exams/[id]/start/route";

/** J = 2099-01-01 (local Africa/Porto-Novo) : minuit local = 2098-12-31T23:00Z. */
const FUTURE_OPENS_ON = new Date("2098-12-31T23:00:00Z");
const FUTURE_SCHEDULED_AT = new Date("2099-01-01T07:00:00Z"); // 08:00 locale

const params = { params: Promise.resolve({ id: "exam-1" }) };

function callStart() {
  return POST(
    new Request("http://localhost/api/exams/exam-1/start", { method: "POST" }),
    params,
  );
}

function examShape(overrides: Record<string, unknown> = {}) {
  return {
    id: "exam-1",
    status: "SCHEDULED",
    duration: 3600,
    type: "MOCK",
    opensOn: FUTURE_OPENS_ON,
    scheduledAt: FUTURE_SCHEDULED_AT,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  deps.getAdminUser.mockResolvedValue(null as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.applyRateLimitByUser.mockResolvedValue({ allowed: true } as never);
  db.enrollmentFindUnique.mockResolvedValue({
    id: "enrollment-1",
    status: "ACTIVE",
  } as never);
  db.userFindUnique.mockResolvedValue({ id: "user-1", examId: null } as never);
  db.sessionFindFirst.mockResolvedValue(null as never);
  db.sessionUpsert.mockResolvedValue({
    id: "session-1",
    status: "IN_PROGRESS",
    startedAt: new Date(),
  } as never);
  db.examUpdate.mockResolvedValue({} as never);
  db.examUpdateMany.mockResolvedValue({ count: 0 } as never);
});

describe("POST /api/exams/[id]/start — avant le jour J", () => {
  it("401 sans authentification", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callStart();
    expect(res.status).toBe(401);
  });

  it("404 pour un examen inexistant (et non 423)", async () => {
    db.examFindUnique.mockResolvedValue(null as never);
    const res = await callStart();
    expect(res.status).toBe(404);
  });

  it("423 EXAM_LOCKED quand la journée d'ouverture est future", async () => {
    db.examFindUnique.mockResolvedValue(examShape() as never);
    const res = await callStart();
    expect(res.status).toBe(423);
    expect((await res.json()).code).toBe("EXAM_LOCKED");
  });

  it("423 avant scheduledAt le jour J (minuit local passé, heure non atteinte)", async () => {
    db.examFindUnique.mockResolvedValue(
      examShape({
        opensOn: new Date(Date.now() - 3600_000), // J ouvert depuis 1 h
        scheduledAt: new Date(Date.now() + 3600_000), // mais dans 1 h
      }) as never,
    );
    const res = await callStart();
    expect(res.status).toBe(423);
  });

  it("423 une seconde avant scheduledAt", async () => {
    db.examFindUnique.mockResolvedValue(
      examShape({
        opensOn: new Date(Date.now() - 86_400_000),
        scheduledAt: new Date(Date.now() + 1_000),
      }) as never,
    );
    const res = await callStart();
    expect(res.status).toBe(423);
  });

  it("aucune session créée ni aucun statut basculé quand l'examen est verrouillé", async () => {
    db.examFindUnique.mockResolvedValue(examShape() as never);
    await callStart();
    expect(db.sessionUpsert).not.toHaveBeenCalled();
    expect(db.sessionFindFirst).not.toHaveBeenCalled();
    expect(db.examUpdate).not.toHaveBeenCalled();
    expect(db.examUpdateMany).not.toHaveBeenCalled();
    expect(deps.createAuditLog).not.toHaveBeenCalled();
  });

  it("ARCHIVED n'est jamais démarrable, même échu", async () => {
    db.examFindUnique.mockResolvedValue(
      examShape({
        status: "ARCHIVED",
        opensOn: new Date(Date.now() - 86_400_000),
        scheduledAt: new Date(Date.now() - 3_600_000),
      }) as never,
    );
    const res = await callStart();
    expect([404, 423]).toContain(res.status);
    expect(db.sessionUpsert).not.toHaveBeenCalled();
  });

  it("DRAFT n'est jamais démarrable, même échu", async () => {
    db.examFindUnique.mockResolvedValue(
      examShape({
        status: "DRAFT",
        opensOn: new Date(Date.now() - 86_400_000),
        scheduledAt: new Date(Date.now() - 3_600_000),
      }) as never,
    );
    const res = await callStart();
    expect([404, 423]).toContain(res.status);
    expect(db.sessionUpsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/exams/[id]/start — à l'heure prévue et après", () => {
  function dueExam(overrides: Record<string, unknown> = {}) {
    return examShape({
      status: "PUBLISHED",
      opensOn: new Date(Date.now() - 86_400_000),
      scheduledAt: new Date(Date.now() - 1_000),
      ...overrides,
    });
  }

  it("201 exactement à scheduledAt (comparaison inclusive)", async () => {
    const scheduledAt = new Date(Date.now() - 1_000);
    db.examFindUnique.mockResolvedValue(
      dueExam({ status: "SCHEDULED", scheduledAt }) as never,
    );
    const res = await callStart();
    expect(res.status).toBe(201);
    expect((await res.json()).sessionId).toBe("session-1");
  });

  it("201 le lendemain (J+1) sans condition supplémentaire", async () => {
    db.examFindUnique.mockResolvedValue(
      dueExam({ scheduledAt: new Date(Date.now() - 86_400_000) }) as never,
    );
    const res = await callStart();
    expect(res.status).toBe(201);
  });

  it("la route publique ne bascule PLUS le statut (lazy-open retiré)", async () => {
    db.examFindUnique.mockResolvedValue(
      dueExam({ status: "SCHEDULED" }) as never,
    );
    const res = await callStart();
    expect(res.status).toBe(201);
    // L'ouverture appartient au cron interne : une lecture/écriture publique
    // ne doit jamais muter un statut.
    expect(db.examUpdate).not.toHaveBeenCalled();
    expect(db.examUpdateMany).not.toHaveBeenCalled();
  });

  it("la session créée est auditée", async () => {
    db.examFindUnique.mockResolvedValue(dueExam() as never);
    await callStart();
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "EXAM_STARTED", resourceId: "exam-1" }),
    );
  });
});
