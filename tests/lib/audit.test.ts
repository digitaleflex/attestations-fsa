import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: db.auditLogCreate },
  },
}));

import { createAuditLog } from "../../lib/audit";

beforeEach(() => {
  vi.clearAllMocks();
  db.auditLogCreate.mockResolvedValue({ id: "log-1" } as never);
});

describe("createAuditLog (#134)", () => {
  it("crée un log avec les champs obligatoires", async () => {
    await createAuditLog({
      userId: "user-1",
      action: "EXAM_SUBMITTED",
      resource: "EXAM",
      resourceId: "exam-1",
    });
    expect(db.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          action: "EXAM_SUBMITTED",
          resource: "EXAM",
          resourceId: "exam-1",
        }),
      }),
    );
  });

  it("sérialise oldValue/newValue en JSON", async () => {
    await createAuditLog({
      userId: "user-1",
      action: "GRADE_EXAM",
      resource: "EXAM_SESSION",
      resourceId: "session-1",
      oldValue: { score: 10 },
      newValue: { score: 15 },
    });
    const call = db.auditLogCreate.mock.calls[0][0];
    expect(call.data.oldValue).toEqual({ score: 10 });
    expect(call.data.newValue).toEqual({ score: 15 });
  });

  it("défaut ipAddress à null si absent", async () => {
    await createAuditLog({
      userId: "user-1",
      action: "EXAM_CREATED",
      resource: "EXAM",
      resourceId: "exam-1",
    });
    const call = db.auditLogCreate.mock.calls[0][0];
    expect(call.data.ipAddress).toBeNull();
  });
});
