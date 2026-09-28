import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examFindUnique: vi.fn(),
  examUpdate: vi.fn(),
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
// #256 — le démarrage est borné par IP et par utilisateur.
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimitByUser: deps.applyRateLimitByUser,
}));

import { POST } from "../../app/api/exams/[id]/start/route";

function callStart() {
  const request = new Request("http://localhost/api/exams/exam-1/start", {
    method: "POST",
  });
  return POST(request, { params: Promise.resolve({ id: "exam-1" }) });
}

function stubAuthorized() {
  deps.getCurrentUser.mockResolvedValue({
    id: "user-1",
    name: "Alice",
  } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.applyRateLimitByUser.mockResolvedValue({ allowed: true } as never);
  deps.getAdminUser.mockResolvedValue(null as never);
}

function stubExam() {
  db.examFindUnique.mockResolvedValue({
    id: "exam-1",
    status: "PUBLISHED",
    duration: 3600,
    type: "OFFICIAL",
    // Verrouillage : un examen n'est disponible que si sa programmation est
    // atteinte. On simule un examen publié et déjà échu.
    scheduledAt: new Date(Date.now() - 60_000),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAuthorized();
  stubExam();
  db.userFindUnique.mockResolvedValue({ id: "user-1", examId: null } as never);
  db.enrollmentFindUnique.mockResolvedValue({ id: "enrollment-1", status: "ACTIVE" } as never);
});

describe("POST /api/exams/[id]/start", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callStart();
    expect(res.status).toBe(401);
  });

  it("404 si l'examen n'existe pas", async () => {
    db.examFindUnique.mockResolvedValue(null as never);
    const res = await callStart();
    expect(res.status).toBe(404);
  });

  it("423 (EXAM_LOCKED) si l'examen n'est pas encore ouvert", async () => {
    // #256 m9 — avant le jour J : 423 et non 404, la date d'ouverture est
    // annoncée mais aucun contenu d'examen ne l'est.
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      status: "SCHEDULED",
      duration: 3600,
      type: "OFFICIAL",
      scheduledAt: new Date("2099-01-01T08:00:00Z"),
    } as never);
    const res = await callStart();
    expect(res.status).toBe(423);
    const body = await res.json();
    expect(body.code).toBe("EXAM_LOCKED");
    expect(body.description).toBeUndefined();
    expect(body.duration).toBeUndefined();
    expect(db.sessionFindFirst).not.toHaveBeenCalled();
    expect(db.sessionUpsert).not.toHaveBeenCalled();
  });

  it("423 si l'examen est verrouillé par son statut (DRAFT / ARCHIVED)", async () => {
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      status: "DRAFT",
      duration: 3600,
      type: "OFFICIAL",
      scheduledAt: null,
    } as never);
    const res = await callStart();
    expect(res.status).toBe(423);
    expect((await res.json()).code).toBe("EXAM_LOCKED");
  });

  it("403 pour un OFFICIAL sans enrollment, même avec une session existante", async () => {
    db.enrollmentFindUnique.mockResolvedValue(null as never);
    db.sessionFindFirst.mockResolvedValue({
      id: "session-1",
      status: "IN_PROGRESS",
      startedAt: new Date(),
    } as never);

    const res = await callStart();

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("EXAM_NOT_ENROLLED");
    expect(db.sessionFindFirst).not.toHaveBeenCalled();
    expect(db.sessionUpsert).not.toHaveBeenCalled();
  });

  it("laisse un MOCK démarrer sans enrollment", async () => {
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      status: "PUBLISHED",
      duration: 3600,
      type: "MOCK",
      scheduledAt: new Date(Date.now() - 60_000),
    } as never);
    db.sessionFindFirst.mockResolvedValue(null as never);
    db.sessionUpsert.mockResolvedValue({
      id: "session-mock",
      status: "IN_PROGRESS",
      startedAt: new Date(),
    } as never);

    const res = await callStart();

    expect(res.status).toBe(201);
    expect(db.enrollmentFindUnique).not.toHaveBeenCalled();
  });

  it("reprend une session IN_PROGRESS existante", async () => {
    db.sessionFindFirst.mockResolvedValue({
      id: "session-1",
      status: "IN_PROGRESS",
      startedAt: new Date(Date.now() - 60_000),
    } as never);
    const res = await callStart();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe("session-1");
    expect(body.status).toBe("IN_PROGRESS");
    expect(db.sessionUpsert).not.toHaveBeenCalled();
  });

  it("rejette une session déjà soumise (COMPLETED)", async () => {
    db.sessionFindFirst.mockResolvedValue({
      id: "session-1",
      status: "COMPLETED",
      startedAt: new Date(),
    } as never);
    const res = await callStart();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("déjà soumis");
  });

  it("crée une session via upsert (anti-race #121)", async () => {
    db.sessionFindFirst.mockResolvedValue(null as never);
    db.sessionUpsert.mockResolvedValue({
      id: "session-new",
      status: "IN_PROGRESS",
      startedAt: new Date(),
    } as never);
    const res = await callStart();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sessionId).toBe("session-new");
    // upsert sur la clé unique composée (userId, examId)
    expect(db.sessionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_examId: { userId: "user-1", examId: "exam-1" },
        },
        create: expect.objectContaining({
          examId: "exam-1",
          userId: "user-1",
          status: "IN_PROGRESS",
        }),
      }),
    );
  });

  it("deux POST simultanés → une seule session (upsert, pas de doublon)", async () => {
    // findFirst ne voit rien pour les deux appels (course), l'upsert
    // garantit qu'une seule ligne existe : le 2e upsert retombe sur update:{}.
    db.sessionFindFirst.mockResolvedValue(null as never);
    db.sessionUpsert
      .mockResolvedValueOnce({
        id: "session-1",
        status: "IN_PROGRESS",
        startedAt: new Date(),
      } as never)
      .mockResolvedValueOnce({
        id: "session-1",
        status: "IN_PROGRESS",
        startedAt: new Date(),
      } as never);

    const [r1, r2] = await Promise.all([callStart(), callStart()]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const b1 = await r1.json();
    const b2 = await r2.json();
    // Même session renvoyée, aucune création dupliquée
    expect(b1.sessionId).toBe(b2.sessionId);
    expect(db.sessionUpsert).toHaveBeenCalledTimes(2);
  });
});
