import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/exam-draft", () => ({
  saveDraft: vi.fn(),
  loadDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));

import { POST, GET, DELETE } from "@/app/api/exams/[id]/draft/route";
import { getCurrentUser } from "@/lib/auth";
import { saveDraft, loadDraft, deleteDraft } from "@/lib/exam-draft";

const mockGetUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockSave = saveDraft as ReturnType<typeof vi.fn>;
const mockLoad = loadDraft as ReturnType<typeof vi.fn>;
const mockDelete = deleteDraft as ReturnType<typeof vi.fn>;

function buildParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildRequest(body?: unknown): Request {
  return {
    json: async () => body,
    headers: new Map() as unknown as Headers,
  } as Request;
}

describe("POST /api/exams/[id]/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-1", role: "user" });
  });

  it("rejette sans authentification", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(buildRequest({ answers: {} }), buildParams("exam-1"));
    expect(res.status).toBe(401);
  });

  it("sauvegarde un brouillon valide", async () => {
    mockSave.mockResolvedValue(true);
    const res = await POST(
      buildRequest({ answers: { q1: "A" }, timeRemaining: 3000, currentPart: 1 }),
      buildParams("exam-1"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(true);
  });

  it("rejette des réponses invalides", async () => {
    const res = await POST(buildRequest({ answers: "invalid" }), buildParams("exam-1"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/exams/[id]/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-1", role: "user" });
  });

  it("retourne un brouillon existant", async () => {
    mockLoad.mockResolvedValue({ answers: { q1: "A" }, timeRemaining: 3000, currentPart: 1, lastSync: "2026-01-01" });
    const res = await GET(buildRequest(), buildParams("exam-1"));
    const data = await res.json();
    expect(data.draft).not.toBeNull();
    expect(data.draft.answers.q1).toBe("A");
  });

  it("retourne null si pas de brouillon", async () => {
    mockLoad.mockResolvedValue(null);
    const res = await GET(buildRequest(), buildParams("exam-1"));
    const data = await res.json();
    expect(data.draft).toBeNull();
  });
});

describe("DELETE /api/exams/[id]/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-1", role: "user" });
  });

  it("supprime le brouillon", async () => {
    mockDelete.mockResolvedValue(true);
    const res = await DELETE(buildRequest(), buildParams("exam-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });
});
