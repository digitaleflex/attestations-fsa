import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findMany: db.sessionFindMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createNotification: vi.fn(),
  sendTranscript: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));
vi.mock("@/lib/email", () => ({
  emailService: { sendOfficialTranscriptNotification: deps.sendTranscript },
}));

import { POST } from "../../app/api/admin/notifications/results/route";

function callPost(body: unknown) {
  return POST(
    new Request("http://localhost/api/admin/notifications/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    status: "COMPLETED",
    finalScore: 80,
    candidate: { id: "user-1", name: "Alice", email: "alice@example.com" },
    exam: { title: "Examen A", name: "Examen A", passingScore: 65 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1", email: "admin@fsa.bj" } as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.sendTranscript.mockResolvedValue(undefined as never);
  db.sessionFindMany.mockResolvedValue([makeSession()] as never);
});

describe("POST /api/admin/notifications/results (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost({ examId: "exam-1" });
    expect(res.status).toBe(401);
  });

  it("404 si aucune session", async () => {
    db.sessionFindMany.mockResolvedValue([] as never);
    const res = await callPost({ examId: "exam-1" });
    expect(res.status).toBe(404);
  });

  it("200 — notifie les candidats (in-app + email) avec résumé", async () => {
    const res = await callPost({ examId: "exam-1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary.total).toBe(1);
    expect(body.summary.success).toBe(1);
    expect(deps.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "EXAM_RESULT_PUBLISHED" }),
    );
    expect(deps.sendTranscript).toHaveBeenCalled();
  });

  it("candidat sous le seuil → compté en échec", async () => {
    db.sessionFindMany.mockResolvedValue([
      makeSession({ finalScore: 40 }),
    ] as never);
    const res = await callPost({ examId: "exam-1" });
    const body = await res.json();
    expect(body.summary.failure).toBe(1);
    expect(body.summary.success).toBe(0);
  });
});