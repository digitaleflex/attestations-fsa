import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  examFindUnique: vi.fn(),
  examUpdate: vi.fn(),
  examDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: {
      findUnique: db.examFindUnique,
      update: db.examUpdate,
      delete: db.examDelete,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("next/cache", () => ({ revalidateTag: deps.revalidateTag }));

import { GET, PATCH, DELETE } from "../../app/api/admin/exams/[id]/route";

const params = { params: Promise.resolve({ id: "exam-1" }) };

function callGet() {
  return GET(new NextRequest("http://localhost/api/admin/exams/exam-1"), params);
}

function callPatch(body: unknown) {
  return PATCH(
    new NextRequest("http://localhost/api/admin/exams/exam-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    params,
  );
}

function callDelete() {
  return DELETE(
    new NextRequest("http://localhost/api/admin/exams/exam-1", {
      method: "DELETE",
    }),
    params,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.examFindUnique.mockResolvedValue({
    id: "exam-1",
    title: "Examen A",
    formation: { id: "f1" },
    parts: [],
  } as never);
  db.examUpdate.mockResolvedValue({ id: "exam-1", title: "Examen A" } as never);
  db.examDelete.mockResolvedValue({ id: "exam-1" } as never);
});

describe("GET /api/admin/exams/[id] (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne l'examen", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Examen A");
  });
});

describe("PATCH /api/admin/exams/[id] (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPatch({ title: "X" });
    expect(res.status).toBe(401);
  });

  it("calcule totalPoints depuis les parties activées (#118)", async () => {
    const res = await callPatch({
      title: "Examen modifié",
      parts: [
        { title: "QCM", type: "QCM", points: 30, order: 1, enabled: true, questions: [] },
        { title: "OPEN", type: "OPEN", points: 50, order: 2, enabled: true, questions: [] },
        { title: "OFF", type: "CASE_STUDY", points: 20, order: 3, enabled: false, questions: [] },
      ],
    });
    expect(res.status).toBe(200);
    expect(db.examUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exam-1" },
        data: expect.objectContaining({
          totalPoints: 80, // 30 + 50 (la partie disabled est exclue)
          part1Enabled: true,
          part2Enabled: true,
          part3Enabled: false,
        }),
      }),
    );
  });

  it("m8 — name synchronisé avec title", async () => {
    await callPatch({ title: "Nouveau titre" });
    const call = db.examUpdate.mock.calls[0][0];
    expect(call.data.title).toBe("Nouveau titre");
    expect(call.data.name).toBe("Nouveau titre");
  });

  it("m6 — randomizeQuestions absent du body → undefined (pas écrasé à false)", async () => {
    await callPatch({ title: "X" });
    const call = db.examUpdate.mock.calls[0][0];
    expect(call.data.randomizeQuestions).toBeUndefined();
    expect(call.data.showResults).toBeUndefined();
  });

  it("m6 — randomizeQuestions présent → appliqué", async () => {
    await callPatch({ title: "X", randomizeQuestions: true });
    const call = db.examUpdate.mock.calls[0][0];
    expect(call.data.randomizeQuestions).toBe(true);
  });
});

describe("DELETE /api/admin/exams/[id] (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callDelete();
    expect(res.status).toBe(401);
  });

  it("supprime l'examen + audit + revalidate", async () => {
    const res = await callDelete();
    expect(res.status).toBe(200);
    expect(db.examDelete).toHaveBeenCalledWith({ where: { id: "exam-1" } });
    expect(deps.createAuditLog).toHaveBeenCalled();
    expect(deps.revalidateTag).toHaveBeenCalledWith("exams", { expire: 0 });
  });
});