import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
  sessionUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: {
      findUnique: db.sessionFindUnique,
      update: db.sessionUpdate,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
  createNotification: vi.fn(),
  pusherTrigger: vi.fn(),
  issueExamAttestation: vi.fn(),
  sendExamResults: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));
vi.mock("@/lib/pusher", () => ({
  pusherServer: { trigger: deps.pusherTrigger },
}));
vi.mock("@/lib/attestations/issue", () => ({
  issueExamAttestation: deps.issueExamAttestation,
}));
vi.mock("@/lib/email", () => ({
  emailService: { sendExamResults: deps.sendExamResults },
}));

import { POST } from "../../app/api/admin/submissions/[id]/correct/route";

// Examen : p1=60/p2=20/p3=20, seuil 50 (scénario de l'issue #117)
function makeSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    examId: "exam-1",
    userId: "user-1",
    status: "PENDING_REVIEW",
    scorePart1: 60,
    scorePart2: null,
    scorePart3: null,
    score: 60,
    totalScore: 60,
    internshipScore: 0,
    finalScore: 60,
    answers: {},
    exam: {
      id: "exam-1",
      title: "Examen FSA",
      type: "OFFICIAL",
      part1Enabled: true,
      part2Enabled: true,
      part3Enabled: true,
      part1Points: 60,
      part2Points: 20,
      part3Points: 20,
      passingScore: 50,
    },
    candidate: {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
    },
    ...overrides,
  } as never;
}

function callCorrect(body: unknown) {
  const request = new Request(
    "http://localhost/api/admin/submissions/sub-1/correct",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return POST(request, { params: Promise.resolve({ id: "sub-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.pusherTrigger.mockResolvedValue(undefined as never);
  deps.issueExamAttestation.mockResolvedValue({ created: true } as never);
  deps.sendExamResults.mockResolvedValue(undefined as never);
});

describe("POST /api/admin/submissions/[id]/correct — sentinelle parties 2/3 (#117)", () => {
  it("refuse GRADED si une partie activée n'est pas notée (première correction)", async () => {
    db.sessionFindUnique.mockResolvedValue(makeSubmission());

    const res = await callCorrect({ part1Score: 60 });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/Partie 2 non corrigée/);
    expect(db.sessionUpdate).not.toHaveBeenCalled();
    expect(deps.issueExamAttestation).not.toHaveBeenCalled();
  });

  it("refuse GRADED si part2 notée mais part3 non notée", async () => {
    db.sessionFindUnique.mockResolvedValue(makeSubmission());

    const res = await callCorrect({ part1Score: 60, part2Score: 20 });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/Partie 3 non corrigée/);
    expect(db.sessionUpdate).not.toHaveBeenCalled();
    expect(deps.issueExamAttestation).not.toHaveBeenCalled();
  });

  it("accepte la correction complète et émet l'attestation", async () => {
    db.sessionFindUnique.mockResolvedValue(makeSubmission());
    db.sessionUpdate.mockResolvedValue(
      makeSubmission({ status: "GRADED", scorePart2: 20, scorePart3: 20 }),
    );

    const res = await callCorrect({
      part1Score: 60,
      part2Score: 20,
      part3Score: 20,
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.passed).toBe(true);
    expect(json.attestationGenerated).toBe(true);
    expect(db.sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: "GRADED",
          scorePart2: 20,
          scorePart3: 20,
        }),
      }),
    );
    expect(deps.issueExamAttestation).toHaveBeenCalledWith("sub-1");
  });

  it("autorise la re-correction partielle d'une session déjà GRADED (sans null)", async () => {
    db.sessionFindUnique.mockResolvedValue(
      makeSubmission({
        status: "GRADED",
        scorePart2: 20,
        scorePart3: 20,
      }),
    );
    db.sessionUpdate.mockResolvedValue(
      makeSubmission({ status: "GRADED", scorePart2: 20, scorePart3: 20 }),
    );

    // Re-correction : on ne renvoie que part1 — les parties 2/3 gardent leur valeur stockée
    const res = await callCorrect({ part1Score: 55 });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.passed).toBe(true);
    expect(db.sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scorePart2: 20,
          scorePart3: 20,
        }),
      }),
    );
  });
});
