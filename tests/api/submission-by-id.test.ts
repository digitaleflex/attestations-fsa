import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const db = vi.hoisted(() => ({
  examSessionFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findUnique: db.examSessionFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  handleApiError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/error-handler", () => ({
  handleApiError: deps.handleApiError,
}));

import { GET } from "../../app/api/submissions/[id]/route";
import { makeRequest } from "../helpers/request";

function callGet() {
  return GET(makeRequest({}) as never, {
    params: Promise.resolve({ id: "sess-1" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.handleApiError.mockReturnValue(
    NextResponse.json({ error: "server" }, { status: 500 }) as never,
  );
  db.examSessionFindUnique.mockResolvedValue({
    id: "sess-1",
    candidate: { id: "user-1" },
    scans: [],
    exam: { id: "exam-1", parts: [] },
  } as never);
});

describe("GET /api/submissions/[id]", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
    expect(db.examSessionFindUnique).not.toHaveBeenCalled();
  });

  it("404 si la soumission n'existe pas", async () => {
    db.examSessionFindUnique.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  it("200 renvoie la soumission complète", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("sess-1");
    expect(body.exam.parts).toEqual([]);
  });

  it("500 via handleApiError si la lecture échoue", async () => {
    db.examSessionFindUnique.mockRejectedValue(new Error("db down") as never);
    const res = await callGet();
    expect(res.status).toBe(500);
    expect(deps.handleApiError).toHaveBeenCalled();
  });
});
