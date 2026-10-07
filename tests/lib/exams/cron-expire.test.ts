import { vi, describe, it, expect, beforeEach } from "vitest";

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

import { expireDueSessions, verifyCronSecret } from "../../../lib/exams/cron-expire";

describe("cron-expire — verifyCronSecret", () => {
  it("refuse si CRON_SECRET absent", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronSecret("Bearer abc")).toBe(false);
  });

  it("refuse si CRON_SECRET trop court", () => {
    process.env.CRON_SECRET = "short";
    expect(verifyCronSecret("Bearer abc")).toBe(false);
  });

  it("refuse sans en-tête Authorization", () => {
    process.env.CRON_SECRET = "a".repeat(20);
    expect(verifyCronSecret(null)).toBe(false);
  });

  it("refuse un mauvais format d'en-tête", () => {
    process.env.CRON_SECRET = "a".repeat(20);
    expect(verifyCronSecret("Basic abc")).toBe(false);
  });

  it("accepte un Bearer token valide", () => {
    process.env.CRON_SECRET = "a".repeat(20);
    expect(verifyCronSecret(`Bearer ${"a".repeat(20)}`)).toBe(true);
  });

  it("refuse un Bearer token invalide", () => {
    process.env.CRON_SECRET = "a".repeat(20);
    expect(verifyCronSecret(`Bearer ${"b".repeat(20)}`)).toBe(false);
  });
});

describe("cron-expire — expireDueSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.userFindFirst.mockResolvedValue({ id: "admin-1" } as never);
    db.auditLogCreate.mockResolvedValue(undefined as never);
  });

  it("ne fait rien si aucune session échue", async () => {
    db.examSessionFindMany.mockResolvedValue([] as never);
    const result = await expireDueSessions(new Date("2026-10-07T12:00:00Z"));
    expect(result.expired).toBe(0);
    expect(db.examSessionUpdateMany).not.toHaveBeenCalled();
  });

  it("expire les sessions IN_PROGRESS dont expiresAt est atteint", async () => {
    db.examSessionFindMany.mockResolvedValue([
      { id: "s1", status: "IN_PROGRESS", expiresAt: new Date("2026-10-07T11:00:00Z") },
      { id: "s2", status: "IN_PROGRESS", expiresAt: new Date("2026-10-07T11:30:00Z") },
    ] as never);
    db.examSessionUpdateMany.mockResolvedValue({ count: 2 } as never);
    const result = await expireDueSessions(new Date("2026-10-07T12:00:00Z"));
    expect(result.expired).toBe(2);
    expect(db.examSessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "IN_PROGRESS" }),
        data: { status: "EXPIRED" },
      }),
    );
  });

  it("journalise chaque expiration dans AuditLog", async () => {
    db.examSessionFindMany.mockResolvedValue([
      { id: "s1", status: "IN_PROGRESS", expiresAt: new Date("2026-10-07T11:00:00Z") },
    ] as never);
    db.examSessionUpdateMany.mockResolvedValue({ count: 1 } as never);
    await expireDueSessions(new Date("2026-10-07T12:00:00Z"));
    expect(db.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "EXAM_SESSION_EXPIRED",
          resource: "EXAM_SESSION",
        }),
      }),
    );
  });

  it("idempotent : un second appel ne touche plus rien", async () => {
    db.examSessionFindMany.mockResolvedValue([] as never);
    await expireDueSessions(new Date("2026-10-07T12:00:00Z"));
    expect(db.examSessionUpdateMany).not.toHaveBeenCalled();
  });

  it("utilise CRON_AUDIT_USER_ID si configuré", async () => {
    process.env.CRON_AUDIT_USER_ID = "cron-actor";
    db.examSessionFindMany.mockResolvedValue([
      { id: "s1", status: "IN_PROGRESS", expiresAt: new Date("2026-10-07T11:00:00Z") },
    ] as never);
    db.examSessionUpdateMany.mockResolvedValue({ count: 1 } as never);
    await expireDueSessions(new Date("2026-10-07T12:00:00Z"));
    expect(db.userFindFirst).not.toHaveBeenCalled();
    expect(db.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "cron-actor" }),
      }),
    );
    delete process.env.CRON_AUDIT_USER_ID;
  });
});
