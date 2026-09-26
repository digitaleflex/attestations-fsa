import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  examFindMany: vi.fn(),
  examUpdateMany: vi.fn(),
  userFindFirst: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: {
      findMany: db.examFindMany,
      updateMany: db.examUpdateMany,
    },
    user: { findFirst: db.userFindFirst },
    auditLog: { create: db.auditCreate },
  },
}));

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: cache.revalidateTag }));

import { POST, GET } from "../../app/api/internal/exams/open/route";

const SECRET = "cron-secret-de-test-0123456789";

function callPost(authorization: string | null = `Bearer ${SECRET}`) {
  return POST(
    new Request("http://localhost/api/internal/exams/open", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  delete process.env.CRON_AUDIT_USER_ID;
  db.examFindMany.mockResolvedValue([]);
  db.examUpdateMany.mockResolvedValue({ count: 0 });
  db.userFindFirst.mockResolvedValue({ id: "admin-1" });
  db.auditCreate.mockResolvedValue({ id: "log-1" });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.CRON_AUDIT_USER_ID;
});

describe("POST /api/internal/exams/open — secret", () => {
  it("401 et aucune mutation si l'en-tête Authorization est absent", async () => {
    const res = await callPost(null);
    expect(res.status).toBe(401);
    expect(db.examFindMany).not.toHaveBeenCalled();
    expect(db.examUpdateMany).not.toHaveBeenCalled();
  });

  it("401 si le secret est incorrect", async () => {
    const res = await callPost("Bearer mauvais-secret-qui-est-long");
    expect(res.status).toBe(401);
    expect(db.examUpdateMany).not.toHaveBeenCalled();
  });

  it("401 si le schéma Bearer est absent", async () => {
    const res = await callPost(SECRET);
    expect(res.status).toBe(401);
    expect(db.examUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse toute mutation si CRON_SECRET n'est pas configuré côté serveur", async () => {
    delete process.env.CRON_SECRET;
    const res = await callPost();
    expect(res.status).toBe(401);
    expect(db.examFindMany).not.toHaveBeenCalled();
  });

  it("accepte un secret valide (schéma Bearer insensible à la casse)", async () => {
    const res = await callPost(`bearer ${SECRET}`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/internal/exams/open — bascule", () => {
  it("ne touche à rien si aucun examen n'est échu", async () => {
    db.examFindMany.mockResolvedValue([]);

    const res = await callPost();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.opened).toBe(0);
    expect(body.ids).toEqual([]);
    expect(db.examUpdateMany).not.toHaveBeenCalled();
    expect(db.auditCreate).not.toHaveBeenCalled();
  });

  it("bascule les examens SCHEDULED échus et journalise chaque bascule", async () => {
    db.examFindMany.mockResolvedValue([
      { id: "e1", status: "SCHEDULED", scheduledAt: new Date("2026-09-26T08:00:00Z") },
      { id: "e2", status: "SCHEDULED", scheduledAt: new Date("2026-09-26T09:00:00Z") },
    ] as never);
    db.examUpdateMany.mockResolvedValue({ count: 2 });

    const res = await callPost();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.opened).toBe(2);
    expect(body.ids).toEqual(["e1", "e2"]);

    // Requête conditionnelle : idempotence garantie côté SQL.
    const where = db.examUpdateMany.mock.calls[0][0].where;
    expect(where.status).toBe("SCHEDULED");
    expect(where.scheduledAt.lte).toBeInstanceOf(Date);
    expect(where.id).toEqual({ in: ["e1", "e2"] });
    expect(db.examUpdateMany.mock.calls[0][0].data).toEqual({ status: "PUBLISHED" });

    expect(db.auditCreate).toHaveBeenCalledTimes(2);
    const first = db.auditCreate.mock.calls[0][0].data;
    expect(first.userId).toBe("admin-1");
    expect(first.action).toBe("EXAM_AUTO_OPENED");
    expect(first.resourceId).toBe("e1");
    expect(first.oldValue.status).toBe("SCHEDULED");
    expect(first.newValue.status).toBe("PUBLISHED");
  });

  it("utilise CRON_AUDIT_USER_ID comme auteur quand il est défini", async () => {
    process.env.CRON_AUDIT_USER_ID = "system-bot";
    db.examFindMany.mockResolvedValue([
      { id: "e1", status: "SCHEDULED", scheduledAt: new Date("2026-09-26T08:00:00Z") },
    ] as never);
    db.examUpdateMany.mockResolvedValue({ count: 1 });

    await callPost();

    expect(db.userFindFirst).not.toHaveBeenCalled();
    expect(db.auditCreate.mock.calls[0][0].data.userId).toBe("system-bot");
  });

  it("ouvre malgré l'absence d'auteur d'audit (l'ouverture ne dépend pas du journal)", async () => {
    db.userFindFirst.mockResolvedValue(null);
    db.examFindMany.mockResolvedValue([
      { id: "e1", status: "SCHEDULED", scheduledAt: new Date("2026-09-26T08:00:00Z") },
    ] as never);
    db.examUpdateMany.mockResolvedValue({ count: 1 });

    const res = await callPost();
    expect(res.status).toBe(200);
    expect((await res.json()).opened).toBe(1);
    expect(db.auditCreate).not.toHaveBeenCalled();
  });

  it("idempotent : un second passage ne rebascule rien", async () => {
    db.examFindMany.mockResolvedValue([
      { id: "e1", status: "SCHEDULED", scheduledAt: new Date("2026-09-26T08:00:00Z") },
    ] as never);
    db.examUpdateMany.mockResolvedValue({ count: 1 });

    const first = await (await callPost()).json();
    expect(first.opened).toBe(1);

    // L'2e exécution ne voit plus l'examen (statut PUBLISHED) et le
    // updateMany conditionnel ne reproduit rien.
    db.examFindMany.mockResolvedValue([]);
    const second = await (await callPost()).json();
    expect(second.opened).toBe(0);
    expect(second.ids).toEqual([]);
  });

  it("concurrent : si le updateMany conditionnel ne touche aucune ligne, rien n'est journalisé", async () => {
    db.examFindMany.mockResolvedValue([
      { id: "e1", status: "SCHEDULED", scheduledAt: new Date("2026-09-26T08:00:00Z") },
    ] as never);
    db.examUpdateMany.mockResolvedValue({ count: 0 });

    const res = await callPost();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.opened).toBe(0);
    expect(db.auditCreate).not.toHaveBeenCalled();
  });

  it("invalide le cache des examens même quand rien n'a été ouvert", async () => {
    const res = await callPost();
    expect(res.status).toBe(200);
    expect(cache.revalidateTag).toHaveBeenCalledWith("exams", { expire: 0 });
  });

  it("n'expose aucune donnée publique d'examen dans la réponse", async () => {
    db.examFindMany.mockResolvedValue([
      { id: "e1", status: "SCHEDULED", scheduledAt: new Date("2026-09-26T08:00:00Z") },
    ] as never);
    db.examUpdateMany.mockResolvedValue({ count: 1 });

    const body = await (await callPost()).json();
    const serialized = JSON.stringify(body);

    expect(Object.keys(body).sort()).toEqual(["ids", "now", "opened"]);
    expect(serialized).not.toContain("description");
    expect(serialized).not.toContain("passingScore");
    expect(serialized).not.toContain("part1");
  });

  it("500 si la base est injoignable, sansmutation partielle", async () => {
    db.examFindMany.mockRejectedValue(new Error("DB down"));

    const res = await callPost();
    expect(res.status).toBe(500);
    expect(db.examUpdateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/exams/open — méthodes", () => {
  it("GET renvoie 405 (route mutante)", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
