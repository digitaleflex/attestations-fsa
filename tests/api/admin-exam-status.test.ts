/**
 * Non-régression — transitions de statut d'un examen côté admin.
 *
 * Spécification : docs/specs/2026-09-25-exam-scheduling-design.md
 *   - `DRAFT -> SCHEDULED` avec `opensOn` et `scheduledAt` obligatoires ;
 *   - `DRAFT -> PUBLISHED` uniquement si l'examen est immédiatement ouvert ;
 *   - `SCHEDULED -> PUBLISHED` uniquement par le cron ou une action admin
 *     explicite ;
 *   - `PUBLISHED -> ARCHIVED` ;
 *   - `ARCHIVED` n'est pas réactivé automatiquement ;
 *   - « Un statut invalide ou une transition interdite renvoie 400, jamais
 *     500. »
 *
 * Complète `tests/api/exams/admin-create.test.ts` (création, #123) et
 * `tests/api/admin-exam-detail.test.ts` (lecture admin).
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examFindUnique: vi.fn(),
  examUpdate: vi.fn(),
  examUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: {
      findUnique: db.examFindUnique,
      update: db.examUpdate,
      updateMany: db.examUpdateMany,
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

import { NextRequest } from "next/server";

import { PATCH } from "../../app/api/admin/exams/[id]/route";

const OPENS_ON = new Date("2099-01-01T07:00:00Z");
const SCHEDULED_AT = new Date("2099-01-01T08:00:00Z");

function callPatch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/admin/exams/exam-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "exam-1" }) },
  );
}

function currentExam(overrides: Record<string, unknown> = {}) {
  return {
    id: "exam-1",
    title: "Examen blanc",
    name: "Examen blanc",
    status: "DRAFT",
    type: "OFFICIAL",
    opensOn: null,
    scheduledAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  db.examUpdate.mockResolvedValue(currentExam() as never);
  db.examUpdateMany.mockResolvedValue({ count: 1 } as never);
});

describe("PATCH /api/admin/exams/[id] — contrôle d'accès", () => {
  it("401 sans compte admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPatch({ status: "PUBLISHED" });
    expect(res.status).toBe(401);
    expect(db.examUpdate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/exams/[id] — statut invalide", () => {
  it("400 pour un statut inconnu, jamais 500", async () => {
    db.examFindUnique.mockResolvedValue(currentExam() as never);
    const res = await callPatch({ status: "EN_LIGNE" });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it("400 pour un statut absent ou vide", async () => {
    db.examFindUnique.mockResolvedValue(currentExam() as never);
    expect((await callPatch({})).status).toBe(400);
    expect((await callPatch({ status: "" })).status).toBe(400);
  });

  it("400 pour un statut injecté en minuscules", async () => {
    db.examFindUnique.mockResolvedValue(currentExam() as never);
    const res = await callPatch({ status: "published" });
    expect(res.status).toBe(400);
  });

  it("aucune écriture sur un statut invalide", async () => {
    db.examFindUnique.mockResolvedValue(currentExam() as never);
    await callPatch({ status: "EN_LIGNE" });
    expect(db.examUpdate).not.toHaveBeenCalled();
    expect(db.examUpdateMany).not.toHaveBeenCalled();
  });

  it("400 pour une date d'ouverture illisible", async () => {
    db.examFindUnique.mockResolvedValue(currentExam() as never);
    const res = await callPatch({
      status: "SCHEDULED",
      opensOn: "pas-une-date",
      scheduledAt: SCHEDULED_AT.toISOString(),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/exams/[id] — DRAFT → SCHEDULED", () => {
  it("400 sans opensOn", async () => {
    db.examFindUnique.mockResolvedValue(currentExam() as never);
    const res = await callPatch({
      status: "SCHEDULED",
      scheduledAt: SCHEDULED_AT.toISOString(),
    });
    expect(res.status).toBe(400);
    expect(db.examUpdate).not.toHaveBeenCalled();
  });

  it("400 sans scheduledAt", async () => {
    db.examFindUnique.mockResolvedValue(currentExam() as never);
    const res = await callPatch({
      status: "SCHEDULED",
      opensOn: OPENS_ON.toISOString(),
    });
    expect(res.status).toBe(400);
    expect(db.examUpdate).not.toHaveBeenCalled();
  });

  it("200 avec opensOn et scheduledAt, les deux persistés", async () => {
    db.examFindUnique.mockResolvedValue(currentExam() as never);
    db.examUpdate.mockResolvedValue(
      currentExam({ status: "SCHEDULED" }) as never,
    );
    const res = await callPatch({
      status: "SCHEDULED",
      opensOn: OPENS_ON.toISOString(),
      scheduledAt: SCHEDULED_AT.toISOString(),
    });
    expect(res.status).toBe(200);
    expect(db.examUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SCHEDULED",
          opensOn: OPENS_ON,
          scheduledAt: SCHEDULED_AT,
        }),
      }),
    );
  });
});

describe("PATCH /api/admin/exams/[id] — DRAFT → PUBLISHED", () => {
  it("400 si l'examen n'est pas immédiatement ouvert (scheduledAt futur)", async () => {
    db.examFindUnique.mockResolvedValue(
      currentExam({ scheduledAt: SCHEDULED_AT, opensOn: OPENS_ON }) as never,
    );
    const res = await callPatch({
      status: "PUBLISHED",
      scheduledAt: SCHEDULED_AT.toISOString(),
      opensOn: OPENS_ON.toISOString(),
    });
    expect(res.status).toBe(400);
    expect(db.examUpdate).not.toHaveBeenCalled();
  });

  it("200 si l'examen est immédiatement ouvert (scheduledAt échu)", async () => {
    const past = new Date(Date.now() - 3_600_000);
    db.examFindUnique.mockResolvedValue(
      currentExam({ scheduledAt: past, opensOn: new Date(past.getTime() - 86_400_000) }) as never,
    );
    db.examUpdate.mockResolvedValue(
      currentExam({ status: "PUBLISHED" }) as never,
    );
    const res = await callPatch({
      status: "PUBLISHED",
      scheduledAt: past.toISOString(),
      opensOn: new Date(past.getTime() - 86_400_000).toISOString(),
    });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/admin/exams/[id] — transitions suivantes", () => {
  it("SCHEDULED → PUBLISHED par action admin explicite", async () => {
    db.examFindUnique.mockResolvedValue(
      currentExam({ status: "SCHEDULED", opensOn: OPENS_ON, scheduledAt: SCHEDULED_AT }) as never,
    );
    db.examUpdate.mockResolvedValue(
      currentExam({ status: "PUBLISHED" }) as never,
    );
    const res = await callPatch({ status: "PUBLISHED" });
    expect(res.status).toBe(200);
    expect(deps.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ resource: "EXAM", resourceId: "exam-1" }),
    );
  });

  it("PUBLISHED → ARCHIVED", async () => {
    db.examFindUnique.mockResolvedValue(currentExam({ status: "PUBLISHED" }) as never);
    db.examUpdate.mockResolvedValue(currentExam({ status: "ARCHIVED" }) as never);
    const res = await callPatch({ status: "ARCHIVED" });
    expect(res.status).toBe(200);
  });

  it("ARCHIVED → PUBLISHED interdit (pas de réactivation automatique)", async () => {
    db.examFindUnique.mockResolvedValue(currentExam({ status: "ARCHIVED" }) as never);
    const res = await callPatch({ status: "PUBLISHED" });
    expect(res.status).toBe(400);
    expect(db.examUpdate).not.toHaveBeenCalled();
  });

  it("ARCHIVED → DRAFT interdit", async () => {
    db.examFindUnique.mockResolvedValue(currentExam({ status: "ARCHIVED" }) as never);
    const res = await callPatch({ status: "DRAFT" });
    expect(res.status).toBe(400);
    expect(db.examUpdate).not.toHaveBeenCalled();
  });

  it("ARCHIVED → SCHEDULED interdit", async () => {
    db.examFindUnique.mockResolvedValue(currentExam({ status: "ARCHIVED" }) as never);
    const res = await callPatch({
      status: "SCHEDULED",
      opensOn: OPENS_ON.toISOString(),
      scheduledAt: SCHEDULED_AT.toISOString(),
    });
    expect(res.status).toBe(400);
    expect(db.examUpdate).not.toHaveBeenCalled();
  });

  it("le cache des examens est invalidé après une transition valide", async () => {
    db.examFindUnique.mockResolvedValue(currentExam({ status: "PUBLISHED" }) as never);
    db.examUpdate.mockResolvedValue(currentExam({ status: "ARCHIVED" }) as never);
    await callPatch({ status: "ARCHIVED" });
    expect(deps.revalidateTag).toHaveBeenCalledWith("exams", { expire: 0 });
  });
});
