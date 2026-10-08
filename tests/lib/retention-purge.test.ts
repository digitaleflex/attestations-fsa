import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  objectsFindMany: vi.fn(),
  objectsDeleteMany: vi.fn(),
  auditDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storedObject: {
      findMany: db.objectsFindMany,
      deleteMany: db.objectsDeleteMany,
    },
    auditLog: {
      deleteMany: db.auditDeleteMany,
      create: db.auditCreate,
    },
    user: { findFirst: db.userFindFirst },
  },
}));

const store = vi.hoisted(() => ({
  delete: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getStorage: () => store,
}));

import {
  AUDIT_LOG_RETENTION_DAYS,
  purgeExpiredRetention,
  verifyCronSecret,
} from "../../lib/jobs/retention-purge";

const NOW = new Date("2026-10-08T00:00:00.000Z");
const SECRET = "cron-secret-de-test-0123456789";

function storedObject(overrides: Record<string, unknown> = {}) {
  return {
    id: "obj-1",
    key: "cv/abcdefghijkl.pdf",
    purpose: "cv",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  delete process.env.CRON_AUDIT_USER_ID;
  db.objectsFindMany.mockResolvedValue([]);
  db.objectsDeleteMany.mockResolvedValue({ count: 0 });
  db.auditDeleteMany.mockResolvedValue({ count: 0 });
  db.auditCreate.mockResolvedValue({ id: "log-1" } as never);
  db.userFindFirst.mockResolvedValue({ id: "admin-1" } as never);
  store.delete.mockResolvedValue(undefined as never);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.CRON_AUDIT_USER_ID;
});

describe("purgeExpiredRetention — objets échus purgés, non échus conservés", () => {
  it("sélectionne les objets via `retentionUntil < now` (NULL = conservation indéfinie, jamais matché)", async () => {
    await purgeExpiredRetention(NOW);

    expect(db.objectsFindMany).toHaveBeenCalledOnce();
    const where = db.objectsFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ retentionUntil: { lt: NOW } });
  });

  it("purge l'objet échu (octets + ligne) et conserve le reste", async () => {
    db.objectsFindMany.mockResolvedValue([storedObject()]);
    db.auditDeleteMany.mockResolvedValue({ count: 0 });

    const result = await purgeExpiredRetention(NOW);

    expect(store.delete).toHaveBeenCalledWith("cv/abcdefghijkl.pdf");
    expect(db.objectsDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["obj-1"] } } });
    expect(result).toEqual(
      expect.objectContaining({ storedObjects: 1, auditLogs: 0, keys: ["cv/abcdefghijkl.pdf"] }),
    );
  });

  it("ne purge JAMAIS les pièces officielles, même échues", async () => {
    db.objectsFindMany.mockResolvedValue([
      storedObject({ id: "obj-off", key: "attestations/officiel.pdf", purpose: "attestation" }),
    ]);

    const result = await purgeExpiredRetention(NOW);

    expect(store.delete).not.toHaveBeenCalled();
    expect(db.objectsDeleteMany).not.toHaveBeenCalled();
    expect(result.storedObjects).toBe(0);
    expect(result.keys).toEqual([]);
  });

  it("conserve la ligne quand les octets sont injoignables (réessai au prochain passage)", async () => {
    db.objectsFindMany.mockResolvedValue([storedObject()]);
    store.delete.mockRejectedValueOnce(new Error("bucket down"));

    const result = await purgeExpiredRetention(NOW);

    expect(db.objectsDeleteMany).not.toHaveBeenCalled();
    expect(result.storedObjects).toBe(0);
  });
});

describe("purgeExpiredRetention — journal d'audit", () => {
  it("purge les AuditLog antérieurs à la fenêtre et écrit une ligne RETENTION_PURGED", async () => {
    db.auditDeleteMany.mockResolvedValue({ count: 3 });

    const result = await purgeExpiredRetention(NOW);

    const expectedCutoff = new Date(
      NOW.getTime() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(db.auditDeleteMany).toHaveBeenCalledWith({
      where: { timestamp: { lt: expectedCutoff } },
    });
    expect(result.auditLogs).toBe(3);

    expect(db.auditCreate).toHaveBeenCalledOnce();
    const data = db.auditCreate.mock.calls[0][0].data;
    expect(data.userId).toBe("admin-1");
    expect(data.action).toBe("RETENTION_PURGED");
    expect(data.resource).toBe("RETENTION");
    expect(data.newValue).toEqual(
      expect.objectContaining({ storedObjects: 0, auditLogs: 3, purgedBy: "cron" }),
    );
  });

  it("purge malgré l'absence d'auteur d'audit (la purge ne dépend pas du journal)", async () => {
    db.objectsFindMany.mockResolvedValue([storedObject()]);
    db.userFindFirst.mockResolvedValue(null);

    const result = await purgeExpiredRetention(NOW);

    expect(result.storedObjects).toBe(1);
    expect(db.auditCreate).not.toHaveBeenCalled();
  });
});

describe("purgeExpiredRetention — idempotence", () => {
  it("un second passage ne purge rien et n'écrit aucune ligne d'audit", async () => {
    db.objectsFindMany.mockResolvedValue([storedObject()]);

    const first = await purgeExpiredRetention(NOW);
    expect(first.storedObjects).toBe(1);
    expect(db.auditCreate).toHaveBeenCalledOnce();

    // L'échéance étant consommée, le passage suivant ne voit plus rien.
    db.objectsFindMany.mockResolvedValue([]);
    db.auditDeleteMany.mockResolvedValue({ count: 0 });

    const second = await purgeExpiredRetention(NOW);
    expect(second).toEqual(
      expect.objectContaining({ storedObjects: 0, auditLogs: 0, keys: [] }),
    );
    expect(db.auditCreate).toHaveBeenCalledTimes(1);
    expect(store.delete).toHaveBeenCalledTimes(1);
  });
});

describe("protection verifyCronSecret (même garde que les autres crons)", () => {
  it("accepte le secret configuré, refuse le reste", () => {
    expect(verifyCronSecret(`Bearer ${SECRET}`)).toBe(true);
    expect(verifyCronSecret(null)).toBe(false);
    expect(verifyCronSecret("Bearer mauvais-secret-qui-est-long")).toBe(false);
    expect(verifyCronSecret(SECRET)).toBe(false);
  });

  it("refuse toute mutation si CRON_SECRET n'est pas configuré côté serveur", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronSecret(`Bearer ${SECRET}`)).toBe(false);
  });
});
