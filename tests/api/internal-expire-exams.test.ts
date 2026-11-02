import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Route cron d'expiration des sessions d'examen (#318).
 *
 * Même contrat que `POST /api/internal/exams/open` : Bearer obligatoire,
 * mutation idempotente, aucune donnée publique dans la réponse, GET → 405.
 */
const db = vi.hoisted(() => ({
  examSessionFindMany: vi.fn(),
  examSessionUpdateMany: vi.fn(),
  userFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: {
      findMany: db.examSessionFindMany,
      updateMany: db.examSessionUpdateMany,
    },
    user: { findFirst: db.userFindFirst },
    auditLog: { create: db.auditLogCreate },
  },
}));

import { POST, GET } from "../../app/api/internal/exams/expire/route";

const SECRET = "cron-secret-de-test-0123456789";

function callPost(authorization: string | null = `Bearer ${SECRET}`) {
  return POST(
    new Request("http://localhost/api/internal/exams/expire", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  delete process.env.CRON_AUDIT_USER_ID;
  db.examSessionFindMany.mockResolvedValue([]);
  db.examSessionUpdateMany.mockResolvedValue({ count: 0 });
  db.userFindFirst.mockResolvedValue({ id: "admin-1" });
  db.auditLogCreate.mockResolvedValue({ id: "log-1" });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.CRON_AUDIT_USER_ID;
});

describe("POST /api/internal/exams/expire — secret", () => {
  it("401 et aucune mutation si l'en-tête Authorization est absent", async () => {
    const res = await callPost(null);
    expect(res.status).toBe(401);
    expect(db.examSessionFindMany).not.toHaveBeenCalled();
    expect(db.examSessionUpdateMany).not.toHaveBeenCalled();
  });

  it("401 si le secret est incorrect", async () => {
    const res = await callPost("Bearer mauvais-secret-qui-est-long");
    expect(res.status).toBe(401);
    expect(db.examSessionUpdateMany).not.toHaveBeenCalled();
  });

  it("401 si le schéma Bearer est absent", async () => {
    const res = await callPost(SECRET);
    expect(res.status).toBe(401);
    expect(db.examSessionUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse toute mutation si CRON_SECRET n'est pas configuré côté serveur", async () => {
    delete process.env.CRON_SECRET;
    const res = await callPost();
    expect(res.status).toBe(401);
    expect(db.examSessionFindMany).not.toHaveBeenCalled();
  });

  it("accepte un secret valide (schéma Bearer insensible à la casse)", async () => {
    const res = await callPost(`bearer ${SECRET}`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/internal/exams/expire — expiration", () => {
  it("ne touche à rien si aucune session n'est échue", async () => {
    db.examSessionFindMany.mockResolvedValue([]);

    const res = await callPost();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.expired).toBe(0);
    expect(body.ids).toEqual([]);
    expect(db.examSessionUpdateMany).not.toHaveBeenCalled();
    expect(db.auditLogCreate).not.toHaveBeenCalled();
  });

  it("bascule les sessions IN_PROGRESS échues et journalise chaque bascule", async () => {
    db.examSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        status: "IN_PROGRESS",
        expiresAt: new Date("2026-10-07T11:00:00Z"),
      },
      {
        id: "s2",
        status: "IN_PROGRESS",
        expiresAt: new Date("2026-10-07T11:30:00Z"),
      },
    ] as never);
    db.examSessionUpdateMany.mockResolvedValue({ count: 2 });

    const res = await callPost();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.expired).toBe(2);
    expect(body.ids).toEqual(["s1", "s2"]);

    const where = db.examSessionUpdateMany.mock.calls[0][0].where;
    expect(where.status).toBe("IN_PROGRESS");
    expect(where.expiresAt.lte).toBeInstanceOf(Date);
    expect(where.id).toEqual({ in: ["s1", "s2"] });
    expect(db.examSessionUpdateMany.mock.calls[0][0].data).toEqual({
      status: "EXPIRED",
    });

    expect(db.auditLogCreate).toHaveBeenCalledTimes(2);
    const first = db.auditLogCreate.mock.calls[0][0].data;
    expect(first.userId).toBe("admin-1");
    expect(first.action).toBe("EXAM_SESSION_EXPIRED");
    expect(first.resourceId).toBe("s1");
    expect(first.oldValue.status).toBe("IN_PROGRESS");
    expect(first.newValue.status).toBe("EXPIRED");
  });

  it("utilise CRON_AUDIT_USER_ID comme auteur quand il est défini", async () => {
    process.env.CRON_AUDIT_USER_ID = "system-bot";
    db.examSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        status: "IN_PROGRESS",
        expiresAt: new Date("2026-10-07T11:00:00Z"),
      },
    ] as never);
    db.examSessionUpdateMany.mockResolvedValue({ count: 1 });

    await callPost();

    expect(db.userFindFirst).not.toHaveBeenCalled();
    expect(db.auditLogCreate.mock.calls[0][0].data.userId).toBe("system-bot");
  });

  it("expire malgré l'absence d'auteur d'audit (l'expiration ne dépend pas du journal)", async () => {
    db.userFindFirst.mockResolvedValue(null);
    db.examSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        status: "IN_PROGRESS",
        expiresAt: new Date("2026-10-07T11:00:00Z"),
      },
    ] as never);
    db.examSessionUpdateMany.mockResolvedValue({ count: 1 });

    const res = await callPost();
    expect(res.status).toBe(200);
    expect((await res.json()).expired).toBe(1);
    expect(db.auditLogCreate).not.toHaveBeenCalled();
  });

  it("idempotent : un second passage n'expire plus rien", async () => {
    db.examSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        status: "IN_PROGRESS",
        expiresAt: new Date("2026-10-07T11:00:00Z"),
      },
    ] as never);
    db.examSessionUpdateMany.mockResolvedValue({ count: 1 });

    const first = await (await callPost()).json();
    expect(first.expired).toBe(1);

    db.examSessionFindMany.mockResolvedValue([]);
    const second = await (await callPost()).json();
    expect(second.expired).toBe(0);
    expect(second.ids).toEqual([]);
  });

  it("concurrent : si l'updateMany conditionnel ne touche aucune ligne, rien n'est journalisé", async () => {
    db.examSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        status: "IN_PROGRESS",
        expiresAt: new Date("2026-10-07T11:00:00Z"),
      },
    ] as never);
    db.examSessionUpdateMany.mockResolvedValue({ count: 0 });

    const res = await callPost();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.expired).toBe(0);
    expect(db.auditLogCreate).not.toHaveBeenCalled();
  });

  it("n'expose aucune donnée publique d'examen dans la réponse", async () => {
    db.examSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        status: "IN_PROGRESS",
        expiresAt: new Date("2026-10-07T11:00:00Z"),
      },
    ] as never);
    db.examSessionUpdateMany.mockResolvedValue({ count: 1 });

    const body = await (await callPost()).json();
    const serialized = JSON.stringify(body);

    expect(Object.keys(body).sort()).toEqual(["expired", "ids", "now"]);
    expect(serialized).not.toContain("description");
    expect(serialized).not.toContain("passingScore");
    expect(serialized).not.toContain("part1");
  });

  it("500 si la base est injoignable, sans mutation partielle", async () => {
    db.examSessionFindMany.mockRejectedValue(new Error("DB down"));

    const res = await callPost();
    expect(res.status).toBe(500);
    expect(db.examSessionUpdateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/exams/expire — méthodes", () => {
  it("GET renvoie 405 (route mutante)", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
