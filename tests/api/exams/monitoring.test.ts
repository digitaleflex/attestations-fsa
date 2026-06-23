import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    securityLog: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/exam-enforcement", () => ({
  evaluateEnforcement: vi.fn(),
  logEnforcement: vi.fn(),
}));

import { POST } from "@/app/api/exams/monitoring/route";
import { getCurrentUser } from "@/lib/auth";
import { evaluateEnforcement } from "@/lib/exam-enforcement";

const mockGetUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockEvaluate = evaluateEnforcement as ReturnType<typeof vi.fn>;

const validPayload = {
  events: [
    { type: "VISIBILITY_CHANGE", timestamp: Date.now(), details: "Changement d'onglet" },
    { type: "BLUR", timestamp: Date.now(), details: "Perte de focus" },
  ],
  examId: "exam-1",
  userId: "user-1",
  timestamp: Date.now(),
};

function buildRequest(body: unknown): Request {
  return {
    json: async () => body,
    headers: new Map([["x-forwarded-for", "127.0.0.1"], ["user-agent", "jest"]]) as unknown as Headers,
  } as Request;
}

describe("POST /api/exams/monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluate.mockResolvedValue({ lockAnswers: false, forceSubmit: false, warnUser: false });
  });

  it("rejette une requête non authentifiée", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(buildRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it("rejette si l'utilisateur n'est pas le propriétaire", async () => {
    mockGetUser.mockResolvedValue({ id: "other-user", role: "user" });
    const res = await POST(buildRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it("accepte les événements valides", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1", role: "user" });
    const res = await POST(buildRequest(validPayload));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(2);
    expect(data.logged).toBe(2);
  });

  it("accepte si l'utilisateur est admin", async () => {
    mockGetUser.mockResolvedValue({ id: "other-user", role: "ADMIN" });
    const res = await POST(buildRequest(validPayload));
    expect(res.status).toBe(200);
  });

  it("rejette un payload invalide", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1", role: "user" });
    const res = await POST(buildRequest({ events: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("rejette un type d'événement invalide", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1", role: "user" });
    const res = await POST(buildRequest({
      ...validPayload,
      events: [{ type: "INVALID_TYPE", timestamp: Date.now() }],
    }));
    expect(res.status).toBe(400);
  });

  it("retourne l'action d'enforcement", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1", role: "user" });
    mockEvaluate.mockResolvedValue({
      lockAnswers: true,
      forceSubmit: false,
      warnUser: true,
      reason: "Test",
    });
    const res = await POST(buildRequest(validPayload));
    const data = await res.json();
    expect(data.enforcement.lockAnswers).toBe(true);
    expect(data.enforcement.warnUser).toBe(true);
  });
});
