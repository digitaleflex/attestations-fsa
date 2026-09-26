import { vi, describe, it, expect, beforeEach } from "vitest";

// #256 m9 — Visibilité future : aucun contenu d'examen (description, barème,
// durée, questions) avant le jour J ; 423 avant ouverture ; start uniquement
// après `scheduledAt` ; submit refusé sur examen reverrouillé ; transitions de
// statut invalides en 400.

const db = vi.hoisted(() => ({
  examFindMany: vi.fn(),
  examFindUnique: vi.fn(),
  examUpdate: vi.fn(),
  examUpdateMany: vi.fn(),
  userFindUnique: vi.fn(),
  enrollmentFindMany: vi.fn(),
  enrollmentFindUnique: vi.fn(),
  sessionFindFirst: vi.fn(),
  sessionFindMany: vi.fn(),
  sessionUpdateMany: vi.fn(),
  sessionUpsert: vi.fn(),
  examPartFindFirst: vi.fn(),
  examPartFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: {
      findMany: db.examFindMany,
      findUnique: db.examFindUnique,
      update: db.examUpdate,
      updateMany: db.examUpdateMany,
    },
    user: { findUnique: db.userFindUnique },
    examEnrollment: {
      findMany: db.enrollmentFindMany,
      findUnique: db.enrollmentFindUnique,
    },
    examSession: {
      findFirst: db.sessionFindFirst,
      findMany: db.sessionFindMany,
      updateMany: db.sessionUpdateMany,
      upsert: db.sessionUpsert,
    },
    examPart: {
      findFirst: db.examPartFindFirst,
      findMany: db.examPartFindMany,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("next/cache", () => ({ revalidateTag: deps.revalidateTag }));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  applyRateLimitByUser: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock("@/lib/exam-draft", () => ({
  saveDraft: vi.fn().mockResolvedValue(true),
  loadDraft: vi.fn().mockResolvedValue({ answers: {} }),
  deleteDraft: vi.fn().mockResolvedValue(true),
  isValidExamDraft: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/attestations/issue", () => ({
  issueExamAttestation: vi.fn().mockResolvedValue(undefined),
}));

import { GET as userExamsGET } from "@/app/api/user/exams/route";
import { GET as scheduledGET } from "@/app/api/exams/scheduled/route";
import { GET as draftGET, POST as draftPOST } from "@/app/api/exams/[id]/draft/route";
import { POST as submitPOST } from "@/app/api/exams/[id]/submit/route";
import { PATCH as adminPatch } from "@/app/api/admin/exams/[id]/route";
import { NextRequest } from "next/server";

const PAST = () => new Date(Date.now() - 60_000);
const FUTURE = () => new Date(Date.now() + 7 * 24 * 3_600_000);

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1", name: "Alice" } as never);
  deps.getAdminUser.mockResolvedValue(null as never);
  db.examUpdateMany.mockResolvedValue({ count: 0 } as never);
  db.userFindUnique.mockResolvedValue({ id: "user-1" } as never);
  db.enrollmentFindMany.mockResolvedValue([] as never);
  db.enrollmentFindUnique.mockResolvedValue({ id: "enrollment-1", status: "ACTIVE" } as never);
  db.sessionFindMany.mockResolvedValue([] as never);
});

function futureExam() {
  return {
    id: "exam-1",
    title: "Examen officiel",
    name: "Examen officiel",
    description: "SECRET — barème et sujet",
    totalPoints: 100,
    passingScore: 65,
    duration: 7200,
    part1Questions: 20,
    part2Questions: 5,
    part3Enabled: true,
    type: "OFFICIAL",
    status: "SCHEDULED",
    scheduledAt: FUTURE(),
  };
}

function openedExam() {
  return { ...futureExam(), status: "PUBLISHED", scheduledAt: PAST() };
}

describe("#256 m9 — /api/user/exams (liste candidat)", () => {
  it("ne livre aucun contenu futur avant le jour J", async () => {
    db.examFindMany.mockResolvedValue([futureExam()] as never);
    db.enrollmentFindMany.mockResolvedValue([{ examId: "exam-1" }] as never);

    const res = await userExamsGET(
      new Request("http://localhost/api/user/exams"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const exam = body.exams[0];

    expect(exam.examName).toBe("Examen officiel");
    expect(exam.scheduledAt).toBeTruthy();
    expect(exam.isAvailable).toBe(false);
    expect(exam.locked).toBe(true);
    // Aucun contenu futur
    expect(exam.examDescription).toBeNull();
    expect(exam.duration).toBeNull();
    expect(exam.questionCount).toBeNull();
    expect(exam.maxScore).toBeNull();
    expect(exam.passingScore).toBeNull();
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });

  it("livre le contenu une fois le jour J atteint", async () => {
    db.examFindMany.mockResolvedValue([openedExam()] as never);
    db.enrollmentFindMany.mockResolvedValue([{ examId: "exam-1" }] as never);

    const res = await userExamsGET(
      new Request("http://localhost/api/user/exams"),
    );
    const body = await res.json();
    const exam = body.exams[0];

    expect(exam.locked).toBe(false);
    expect(exam.isAvailable).toBe(true);
    expect(exam.examDescription).toBe("SECRET — barème et sujet");
    expect(exam.duration).toBe("120 minutes");
    expect(exam.questionCount).toBe(26);
    expect(exam.maxScore).toBe(100);
  });
});

describe("#256 m9 — /api/exams/scheduled (annonces publiques)", () => {
  it("n'annonce que la date : ni description ni durée", async () => {
    db.examFindMany.mockResolvedValue([
      { ...futureExam(), status: "SCHEDULED" },
    ] as never);

    const res = await scheduledGET(
      new Request("http://localhost/api/exams/scheduled"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const exam = body.exams[0];

    expect(exam.title).toBe("Examen officiel");
    expect(exam.scheduledAt).toBeTruthy();
    expect(exam.locked).toBe(true);
    expect(exam.description).toBeNull();
    expect(exam.duration).toBeNull();
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });
});

describe("#256 m9 — /api/exams/[id]/draft", () => {
  it("423 tant que le jour J n'est pas atteint (GET et POST)", async () => {
    db.examFindUnique.mockResolvedValue(futureExam() as never);
    const request = () =>
      new Request("http://localhost/api/exams/exam-1/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { q1: "o1" } }),
      });

    const params = { params: Promise.resolve({ id: "exam-1" }) };
    const post = await draftPOST(request(), params);
    expect(post.status).toBe(423);
    expect((await post.json()).code).toBe("EXAM_LOCKED");

    const get = await draftGET(
      new Request("http://localhost/api/exams/exam-1/draft"),
      params,
    );
    expect(get.status).toBe(423);
  });
});

describe("#256 m9 — /api/exams/[id]/submit (reverrouillage)", () => {
  it("423 et aucune écriture si l'examen a été reverrouillé", async () => {
    // L'admin a archivé l'examen (ou repoussé la date) pendant la session.
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      type: "OFFICIAL",
      duration: 3600,
      status: "ARCHIVED",
      scheduledAt: PAST(),
      part1Points: 20,
    } as never);
    db.sessionFindFirst.mockResolvedValue({
      id: "session-1",
      startedAt: new Date(),
      status: "IN_PROGRESS",
      submittedAt: null,
    } as never);

    const res = await submitPOST(
      new Request("http://localhost/api/exams/exam-1/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { q1: "o1" } }),
      }),
      { params: Promise.resolve({ id: "exam-1" }) },
    );

    expect(res.status).toBe(423);
    expect((await res.json()).code).toBe("EXAM_LOCKED");
    // Le verrou est évalué AVANT la session : rien n'est lu ni écrit.
    expect(db.sessionFindFirst).not.toHaveBeenCalled();
    expect(db.sessionUpdateMany).not.toHaveBeenCalled();
  });

  it("423 si la date d'ouverture est repoussée dans le futur", async () => {
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      type: "OFFICIAL",
      duration: 3600,
      status: "PUBLISHED",
      scheduledAt: FUTURE(),
      part1Points: 20,
    } as never);

    const res = await submitPOST(
      new Request("http://localhost/api/exams/exam-1/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { q1: "o1" } }),
      }),
      { params: Promise.resolve({ id: "exam-1" }) },
    );
    expect(res.status).toBe(423);
  });
});

describe("#256 m9 — PATCH /api/admin/exams/[id] (transitions de statut)", () => {
  beforeEach(() => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    db.examUpdate.mockResolvedValue({ id: "exam-1" } as never);
  });

  function patch(body: unknown) {
    return adminPatch(
      new NextRequest("http://localhost/api/admin/exams/exam-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "exam-1" }) },
    );
  }

  it("400 sur transition invalide (ARCHIVED → PUBLISHED)", async () => {
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      status: "ARCHIVED",
      scheduledAt: PAST(),
    } as never);

    const res = await patch({ status: "PUBLISHED" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_EXAM_STATUS_TRANSITION");
    expect(db.examUpdate).not.toHaveBeenCalled();
  });

  it("400 sur statut inconnu", async () => {
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      status: "DRAFT",
      scheduledAt: null,
    } as never);

    const res = await patch({ status: "BROUILLON" });
    expect(res.status).toBe(400);
    expect(db.examUpdate).not.toHaveBeenCalled();
  });

  it("400 : SCHEDULED sans date d'ouverture", async () => {
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      status: "DRAFT",
      scheduledAt: null,
    } as never);

    const res = await patch({ status: "SCHEDULED" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("MISSING_SCHEDULED_AT");
    expect(db.examUpdate).not.toHaveBeenCalled();
  });

  it("transition valide : l'écriture passe", async () => {
    db.examFindUnique.mockResolvedValue({
      id: "exam-1",
      status: "DRAFT",
      scheduledAt: null,
    } as never);

    const res = await patch({
      status: "SCHEDULED",
      scheduledAt: FUTURE().toISOString(),
    });
    expect(res.status).toBe(200);
    expect(db.examUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SCHEDULED",
          scheduledAt: expect.any(Date),
        }),
      }),
    );
  });

  it("404 si l'examen n'existe pas", async () => {
    db.examFindUnique.mockResolvedValue(null as never);
    const res = await patch({ status: "PUBLISHED" });
    expect(res.status).toBe(404);
    expect(db.examUpdate).not.toHaveBeenCalled();
  });
});
