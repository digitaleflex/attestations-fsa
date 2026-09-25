import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  examFindUnique: vi.fn(),
  enrollmentFindUnique: vi.fn(),
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  saveDraft: vi.fn(),
  loadDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: { findUnique: db.examFindUnique },
    examEnrollment: { findUnique: db.enrollmentFindUnique },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
vi.mock("@/lib/exam-draft", () => ({
  saveDraft: deps.saveDraft,
  loadDraft: deps.loadDraft,
  deleteDraft: deps.deleteDraft,
  isValidExamDraft: vi.fn().mockReturnValue(true),
}));

import { GET, POST } from "../../app/api/exams/[id]/draft/route";

const params = { params: Promise.resolve({ id: "exam-1" }) };

function call(method: "GET" | "POST") {
  const request = new Request("http://localhost/api/exams/exam-1/draft", {
    method,
    ...(method === "POST"
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: { q1: "o1" } }),
        }
      : {}),
  });
  return method === "GET" ? GET(request, params) : POST(request, params);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" });
  deps.getAdminUser.mockResolvedValue(null);
  db.examFindUnique.mockResolvedValue({ id: "exam-1", type: "OFFICIAL" });
  db.enrollmentFindUnique.mockResolvedValue(null);
  deps.saveDraft.mockResolvedValue(true);
  deps.loadDraft.mockResolvedValue({ answers: {} });
});

describe("draft exam eligibility", () => {
  it.each(["GET", "POST"] as const)(
    "%s refuse un OFFICIAL sans enrollment",
    async (method) => {
      const res = await call(method);
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("EXAM_NOT_ENROLLED");
      expect(deps.saveDraft).not.toHaveBeenCalled();
      expect(deps.loadDraft).not.toHaveBeenCalled();
    },
  );

  it("POST accepte un MOCK sans enrollment", async () => {
    db.examFindUnique.mockResolvedValue({ id: "exam-1", type: "MOCK" });
    const res = await call("POST");
    expect(res.status).toBe(200);
    expect(deps.saveDraft).toHaveBeenCalledWith("exam-1", "user-1", {
      answers: { q1: "o1" },
      timeRemaining: 0,
      currentPart: 1,
      lastSync: expect.any(String),
    });
  });

  it("le contournement admin est explicite", async () => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" });
    const res = await call("GET");
    expect(res.status).toBe(200);
    expect(db.enrollmentFindUnique).not.toHaveBeenCalled();
  });
});
