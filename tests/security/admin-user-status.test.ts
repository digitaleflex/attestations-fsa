// tests/security/admin-user-status.test.ts
// #304 — L'application du statut de compte par l'administration doit être
// RÉELLEMENT effective : champs Better Auth (banned / banExpires) misalignment
// et révocation immédiate des sessions du compte concerné.
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  accountUpdateMany: vi.fn(),
  sessionDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    user: { update: db.userUpdate },
    account: { updateMany: db.accountUpdateMany },
  };
  return {
    rawPrisma: {},
    prisma: {
      user: { findUnique: db.userFindUnique, update: db.userUpdate },
      account: { updateMany: db.accountUpdateMany },
      session: { deleteMany: db.sessionDeleteMany },
      $transaction: vi.fn(async (arg: unknown) =>
        typeof arg === "function" ? (arg as (c: unknown) => Promise<unknown>)(tx) : arg,
      ),
    },
  };
});

const deps = vi.hoisted(() => ({ getAdminUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(async () => undefined),
}));
vi.mock("@/lib/exams/availability", () => ({
  VISIBLE_EXAM_STATUSES: ["SCHEDULED", "PUBLISHED"],
}));
vi.mock("@/lib/exams/enrollment", () => ({
  grantExamEnrollment: vi.fn(async () => undefined),
  revokeExamEnrollment: vi.fn(async () => undefined),
}));
vi.mock("better-auth/crypto", () => ({ hashPassword: vi.fn(async () => "hashed") }));

import { PATCH } from "../../app/api/users/[id]/route";

const ADMIN = { id: "admin-1", role: "admin" } as never;

function patch(body: unknown) {
  const request = {
    headers: new Headers(),
    json: async () => body,
  } as unknown as Request;
  return PATCH(request, { params: Promise.resolve({ id: "user-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue(ADMIN);
  db.userFindUnique.mockResolvedValue({
    status: "ACTIVE",
    role: "user",
    email: "candidat@exemple.com",
    examId: null,
    examScheduledAt: null,
  });
  db.userUpdate.mockResolvedValue({
    id: "user-1",
    name: "Candidat",
    email: "candidat@exemple.com",
    role: "user",
    birthDate: null,
    birthPlace: null,
    phone: null,
    address: null,
    status: "BLOCKED",
    resetPasswordRequired: false,
    examId: null,
    examScheduledAt: null,
    updatedAt: new Date(),
  });
  db.sessionDeleteMany.mockResolvedValue({ count: 2 });
});

describe("#304 — PATCH /api/users/[id] : blocage effectif", () => {
  it("bannit le compte ET révoque ses sessions", async () => {
    const res = await patch({ status: "BLOCKED", blockedReason: "Fraude" });

    expect(res.status).toBe(200);
    expect(db.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          status: "BLOCKED",
          banned: true,
          banReason: "Fraude",
          banExpires: null,
        }),
      }),
    );
    expect(db.sessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("suspension avec échéance : renseigne banExpires", async () => {
    db.userUpdate.mockResolvedValue({ ...(await db.userFindUnique()) });

    const res = await patch({
      status: "SUSPENDED",
      suspendedUntil: "2026-10-01T00:00:00.000Z",
    });

    expect(res.status).toBe(200);
    const data = db.userUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe("SUSPENDED");
    expect(data.banned).toBe(true);
    expect((data.banExpires as Date).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("réactivation : purge les marqueurs de blocage", async () => {
    await patch({ status: "ACTIVE" });

    const data = db.userUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe("ACTIVE");
    expect(data.banned).toBe(false);
    expect(data.banExpires).toBeNull();
    expect(data.banReason).toBeNull();
  });

  it("ne révoque pas les sessions hors changement de statut", async () => {
    await patch({ name: "Candidat" });

    expect(db.sessionDeleteMany).not.toHaveBeenCalled();
  });

  it("401 sans administrateur authentifié", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);

    const res = await patch({ status: "BLOCKED" });

    expect(res.status).toBe(401);
    expect(db.sessionDeleteMany).not.toHaveBeenCalled();
  });
});
