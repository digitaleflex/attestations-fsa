/**
 * Non-régression — synchronisation du brouillon et ouverture planifiée.
 *
 * Spécification : docs/specs/2026-09-25-exam-scheduling-design.md
 *   - « `draft` et `submit` revérifient la disponibilité à chaque requête » ;
 *   - avant le jour J, `draft` refuse avec `423 EXAM_LOCKED` ;
 *   - aucun brouillon ne doit être lu ni écrit pour un examen verrouillé.
 *
 * Complète `tests/api/exams/draft.test.ts` (validation de forme) et
 * `tests/api/exams-draft-eligibility.test.ts` (inscription / révocation).
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examFindUnique: vi.fn(),
  enrollmentFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: { findUnique: db.examFindUnique },
    examEnrollment: { findUnique: db.enrollmentFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  saveDraft: vi.fn(),
  loadDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimitByUser: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock("@/lib/exam-draft", () => ({
  saveDraft: deps.saveDraft,
  loadDraft: deps.loadDraft,
  deleteDraft: deps.deleteDraft,
  isValidExamDraft: vi.fn().mockReturnValue(true),
}));

import { GET, POST, DELETE } from "../../app/api/exams/[id]/draft/route";

const params = { params: Promise.resolve({ id: "exam-1" }) };

/** J = 2099-01-01 (local Africa/Porto-Novo). */
const FUTURE_OPENS_ON = new Date("2098-12-31T23:00:00Z");
const FUTURE_SCHEDULED_AT = new Date("2099-01-01T07:00:00Z");

function callDraft(method: "GET" | "POST" | "DELETE") {
  const request = new Request("http://localhost/api/exams/exam-1/draft", {
    method,
    ...(method === "POST"
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: { q1: "o1" }, timeRemaining: 1200 }),
        }
      : {}),
  });
  if (method === "GET") return GET(request, params);
  if (method === "POST") return POST(request, params);
  return DELETE(request, params);
}

function lockedExam(overrides: Record<string, unknown> = {}) {
  return {
    id: "exam-1",
    type: "OFFICIAL",
    status: "SCHEDULED",
    opensOn: FUTURE_OPENS_ON,
    scheduledAt: FUTURE_SCHEDULED_AT,
    ...overrides,
  };
}

function openExam(overrides: Record<string, unknown> = {}) {
  return lockedExam({
    status: "PUBLISHED",
    opensOn: new Date(Date.now() - 86_400_000),
    scheduledAt: new Date(Date.now() - 3_600_000),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  deps.getAdminUser.mockResolvedValue(null as never);
  // Candidat inscrit : on isole le contrôle de planning de l'éligibilité.
  db.enrollmentFindUnique.mockResolvedValue({
    id: "enrollment-1",
    status: "ACTIVE",
  } as never);
  deps.saveDraft.mockResolvedValue(true as never);
  deps.loadDraft.mockResolvedValue({ answers: { q1: "o1" } } as never);
  deps.deleteDraft.mockResolvedValue(true as never);
});

describe("draft — refus avant ouverture (J-1)", () => {
  it.each(["GET", "POST", "DELETE"] as const)(
    "%s → 423 EXAM_LOCKED pour un examen non ouvert",
    async (method) => {
      db.examFindUnique.mockResolvedValue(lockedExam() as never);
      const res = await callDraft(method);
      expect(res.status).toBe(423);
      expect((await res.json()).code).toBe("EXAM_LOCKED");
    },
  );

  it.each(["GET", "POST", "DELETE"] as const)(
    "%s → aucun brouillon lu ni écrit quand l'examen est verrouillé",
    async (method) => {
      db.examFindUnique.mockResolvedValue(lockedExam() as never);
      await callDraft(method);
      expect(deps.saveDraft).not.toHaveBeenCalled();
      expect(deps.loadDraft).not.toHaveBeenCalled();
      expect(deps.deleteDraft).not.toHaveBeenCalled();
    },
  );

  it("le verrou vaut aussi le jour J avant l'heure prévue", async () => {
    db.examFindUnique.mockResolvedValue(
      lockedExam({
        opensOn: new Date(Date.now() - 3_600_000),
        scheduledAt: new Date(Date.now() + 3_600_000),
      }) as never,
    );
    const res = await callDraft("POST");
    expect(res.status).toBe(423);
    expect(deps.saveDraft).not.toHaveBeenCalled();
  });

  it("un examen redeployé dans le futur rebloque la synchronisation", async () => {
    // Cas de régression : l'examen était ouvert, la session existe, l'admin
    // repousse `scheduledAt`. La revérification à chaque requête doit
    // refermer l'accès, pas faire confiance à l'état initial.
    db.examFindUnique.mockResolvedValue(lockedExam() as never);
    const res = await callDraft("GET");
    expect(res.status).toBe(423);
    expect(deps.loadDraft).not.toHaveBeenCalled();
  });

  it("un examen ARCHIVED ne synchronise plus de brouillon", async () => {
    db.examFindUnique.mockResolvedValue(
      lockedExam({
        status: "ARCHIVED",
        opensOn: new Date(Date.now() - 86_400_000),
        scheduledAt: new Date(Date.now() - 86_400_000),
      }) as never,
    );
    const res = await callDraft("POST");
    expect([403, 404, 423]).toContain(res.status);
    expect(deps.saveDraft).not.toHaveBeenCalled();
  });
});

describe("draft — fonctionnement après ouverture", () => {
  it("POST enregistre le brouillon une fois l'examen ouvert", async () => {
    db.examFindUnique.mockResolvedValue(openExam() as never);
    const res = await callDraft("POST");
    expect(res.status).toBe(200);
    expect(deps.saveDraft).toHaveBeenCalledWith(
      "exam-1",
      "user-1",
      expect.objectContaining({ answers: { q1: "o1" } }),
    );
  });

  it("GET relit le brouillon une fois l'examen ouvert", async () => {
    db.examFindUnique.mockResolvedValue(openExam() as never);
    const res = await callDraft("GET");
    expect(res.status).toBe(200);
    expect((await res.json()).draft).not.toBeNull();
  });

  it("DELETE supprime le brouillon une fois l'examen ouvert", async () => {
    db.examFindUnique.mockResolvedValue(openExam() as never);
    const res = await callDraft("DELETE");
    expect(res.status).toBe(200);
    expect(deps.deleteDraft).toHaveBeenCalled();
  });

  it("404 pour un examen inexistant (jamais 423)", async () => {
    db.examFindUnique.mockResolvedValue(null as never);
    const res = await callDraft("POST");
    expect(res.status).toBe(404);
    expect(deps.saveDraft).not.toHaveBeenCalled();
  });
});
