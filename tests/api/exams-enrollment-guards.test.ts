// #256/#257 — contrôles NÉGATIFS d'éligibilité et de rate-limit sur les
// quatre points d'entrée du flux examen : GET, start, draft, submit.
//
// Ce fichier ne teste que le refus : un candidat non inscrit (ou dont
// l'inscription est révoquée) ne doit lire ni démarrer ni soumettre un
// OFFICIAL, et aucun quota de rate-limit ne doit être consommé pour rien.

import { beforeEach, describe, expect, it, vi } from "vitest";

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
  applyRateLimit: vi.fn(),
  saveDraft: vi.fn(),
  loadDraft: vi.fn(),
  deleteDraft: vi.fn(),
  createAuditLog: vi.fn(),
  issueExamAttestation: vi.fn(),
  analyzeAnswerPattern: vi.fn(),
  logCheatingDetection: vi.fn(),
  pusherTrigger: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimitByUser: deps.applyRateLimitByUser,
  applyRateLimit: deps.applyRateLimit,
}));
vi.mock("@/lib/exam-draft", () => ({
  saveDraft: deps.saveDraft,
  loadDraft: deps.loadDraft,
  deleteDraft: deps.deleteDraft,
  isValidExamDraft: () => true,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/attestations/issue", () => ({
  issueExamAttestation: deps.issueExamAttestation,
}));
vi.mock("@/lib/anti-cheat", () => ({
  analyzeAnswerPattern: deps.analyzeAnswerPattern,
  logCheatingDetection: deps.logCheatingDetection,
}));
vi.mock("@/lib/pusher", () => ({
  pusherServer: { trigger: deps.pusherTrigger },
}));

import { GET as getExam } from "@/app/api/exams/[id]/route";
import { POST as startExam } from "@/app/api/exams/[id]/start/route";
import { GET as getDraft, POST as saveDraftRoute } from "@/app/api/exams/[id]/draft/route";
import { POST as submitExam } from "@/app/api/exams/[id]/submit/route";

const params = { params: Promise.resolve({ id: "exam-1" }) };

const RATE_LIMITED = {
  allowed: false,
  response: Response.json(
    { error: "Trop de requêtes. Veuillez réessayer plus tard." },
    { status: 429 },
  ),
};

function officialExam() {
  return {
    id: "exam-1",
    title: "Examen officiel",
    name: "Examen officiel",
    description: null,
    status: "PUBLISHED",
    totalPoints: 100,
    duration: 3600,
    formationId: "formation-1",
    type: "OFFICIAL",
    scheduledAt: new Date(Date.now() - 60_000),
    passingScore: 65,
    randomizeQuestions: false,
    showResults: false,
    part1Enabled: true,
    part1Points: 20,
    part1Questions: 1,
    part2Enabled: false,
    part2Points: 0,
    part2Questions: 0,
    part3Enabled: false,
    part3Mode: "digital",
    part3Points: 0,
    part3Subject: null,
    parts: [],
  };
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, init);
}

function submitRequest() {
  return request("/api/exams/exam-1/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: { q1: "o1" } }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1", name: "Alice" });
  deps.getAdminUser.mockResolvedValue(null);
  deps.applyRateLimit.mockResolvedValue({ allowed: true, headers: {} });
  deps.applyRateLimitByUser.mockResolvedValue({ allowed: true, headers: {} });
  deps.createAuditLog.mockResolvedValue(undefined);
  deps.issueExamAttestation.mockResolvedValue({ created: true });
  deps.analyzeAnswerPattern.mockResolvedValue({ isSuspicious: false });
  deps.logCheatingDetection.mockResolvedValue(undefined);
  deps.pusherTrigger.mockResolvedValue(undefined);
  deps.saveDraft.mockResolvedValue({ saved: true });
  deps.loadDraft.mockResolvedValue({ answers: {} });
  deps.deleteDraft.mockResolvedValue({ deleted: true });

  db.examFindUnique.mockResolvedValue(officialExam());
  db.enrollmentFindUnique.mockResolvedValue(null);
  db.sessionFindFirst.mockResolvedValue(null);
  db.sessionUpdateMany.mockResolvedValue({ count: 1 });
  db.examPartFindFirst.mockResolvedValue(null);
  db.examPartFindMany.mockResolvedValue([
    {
      id: "part-qcm",
      type: "QCM",
      points: 20,
      questions: [
        {
          id: "q1",
          type: "SINGLE_CHOICE",
          options: [
            { id: "o1", isCorrect: true },
            { id: "o2", isCorrect: false },
          ],
        },
      ],
    },
  ]);
});

describe("OFFICIAL sans inscription — GET/start/draft/submit (#256)", () => {
  it("GET /api/exams/[id] refuse la lecture d'un OFFICIAL non inscrit", async () => {
    const res = await getExam(
      request("/api/exams/exam-1") as never,
      params as never,
    );

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("EXAM_NOT_ENROLLED");
  });

  it("POST /api/exams/[id]/start refuse sans créer de session", async () => {
    const res = await startExam(request("/api/exams/exam-1/start", { method: "POST" }), params as never);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("EXAM_NOT_ENROLLED");
  });

  it("POST /api/exams/[id]/draft refuse sans écrire de brouillon", async () => {
    const res = await saveDraftRoute(
      request("/api/exams/exam-1/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { q1: "o1" } }),
      }),
      params as never,
    );

    expect(res.status).toBe(403);
    expect(deps.saveDraft).not.toHaveBeenCalled();
  });

  it("GET /api/exams/[id]/draft refuse sans lire de brouillon", async () => {
    const res = await getDraft(
      request("/api/exams/exam-1/draft") as never,
      params as never,
    );

    expect(res.status).toBe(403);
    expect(deps.loadDraft).not.toHaveBeenCalled();
  });

  it("POST /api/exams/[id]/submit refuse sans noter ni émettre d'attestation", async () => {
    const res = await submitExam(submitRequest(), params as never);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("EXAM_NOT_ENROLLED");
    expect(db.sessionUpdateMany).not.toHaveBeenCalled();
    expect(deps.issueExamAttestation).not.toHaveBeenCalled();
    expect(deps.deleteDraft).not.toHaveBeenCalled();
  });
});

describe("inscription RÉVOQUÉE — le retrait est immédiatement effectif", () => {
  beforeEach(() => {
    db.enrollmentFindUnique.mockResolvedValue({
      id: "enrollment-1",
      status: "REVOKED",
    });
  });

  it.each([
    ["GET", () => getExam(request("/api/exams/exam-1") as never, params as never)],
    [
      "start",
      () =>
        startExam(
          request("/api/exams/exam-1/start", { method: "POST" }),
          params as never,
        ),
    ],
    [
      "draft",
      () =>
        getDraft(
          request("/api/exams/exam-1/draft") as never,
          params as never,
        ),
    ],
    ["submit", () => submitExam(submitRequest(), params as never)],
  ])("%s refuse une inscription révoquée", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("EXAM_ENROLLMENT_REVOKED");
  });
});

describe("MOCK — comportement ouvert documenté (#256)", () => {
  beforeEach(() => {
    db.examFindUnique.mockResolvedValue({
      ...officialExam(),
      type: "MOCK",
    });
  });

  it("GET lit un MOCK sans inscription", async () => {
    const res = await getExam(
      request("/api/exams/exam-1") as never,
      params as never,
    );
    expect(res.status).toBe(200);
    expect(db.enrollmentFindUnique).not.toHaveBeenCalled();
  });

  it("draft accepte un MOCK sans inscription", async () => {
    const res = await getDraft(
      request("/api/exams/exam-1/draft") as never,
      params as never,
    );
    expect(res.status).toBe(200);
  });

  it("le MOCK reste ouvert même si une inscription existe et est révoquée", async () => {
    db.enrollmentFindUnique.mockResolvedValue({
      id: "enrollment-1",
      status: "REVOKED",
    });

    const res = await getExam(
      request("/api/exams/exam-1") as never,
      params as never,
    );

    expect(res.status).toBe(200);
    expect(db.enrollmentFindUnique).not.toHaveBeenCalled();
  });
});

describe("rate-limit des points d'entrée examen (#256)", () => {
  it("GET renvoie 429 sans lire l'examen", async () => {
    deps.applyRateLimitByUser.mockResolvedValue(RATE_LIMITED);

    const res = await getExam(
      request("/api/exams/exam-1") as never,
      params as never,
    );

    expect(res.status).toBe(429);
    expect(db.examFindUnique).not.toHaveBeenCalled();
  });

  it("GET borne par IP quand aucun utilisateur n'est identifié (navigation admin)", async () => {
    deps.getCurrentUser.mockResolvedValue(null);
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" });
    deps.applyRateLimit.mockResolvedValue(RATE_LIMITED);

    const res = await getExam(
      request("/api/exams/exam-1") as never,
      params as never,
    );

    expect(res.status).toBe(429);
    expect(deps.applyRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      "examRead",
    );
  });

  it("start renvoie 429 avant toute création de session", async () => {
    deps.applyRateLimitByUser.mockResolvedValue(RATE_LIMITED);

    const res = await startExam(
      request("/api/exams/exam-1/start", { method: "POST" }),
      params as never,
    );

    expect(res.status).toBe(429);
    expect(db.sessionFindFirst).not.toHaveBeenCalled();
    expect(db.examFindUnique).not.toHaveBeenCalled();
  });

  it("draft renvoie 429 avant de consommer de quota d'examen", async () => {
    deps.applyRateLimitByUser.mockResolvedValue(RATE_LIMITED);

    const res = await saveDraftRoute(
      request("/api/exams/exam-1/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { q1: "o1" } }),
      }),
      params as never,
    );

    expect(res.status).toBe(429);
    expect(db.examFindUnique).not.toHaveBeenCalled();
  });

  it("chaque point d'entrée utilise son propre budget", async () => {
    await getExam(request("/api/exams/exam-1") as never, params as never);
    await startExam(
      request("/api/exams/exam-1/start", { method: "POST" }),
      params as never,
    );
    await getDraft(
      request("/api/exams/exam-1/draft") as never,
      params as never,
    );

    const types = deps.applyRateLimitByUser.mock.calls.map((call) => call[2]);
    expect(types).toEqual(["examRead", "examStart", "examDraft"]);
  });
});
