import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: db.userFindMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createNotification: vi.fn(),
  sendEmail: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
}));
vi.mock("@/lib/email", () => ({
  emailService: { sendBulkNotification: deps.sendEmail },
}));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: deps.applyRateLimit,
}));

import { POST } from "../../app/api/admin/notifications/bulk/route";

function callPost(body: unknown) {
  return POST(
    new Request("http://localhost/api/admin/notifications/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.sendEmail.mockResolvedValue(undefined as never);
  deps.applyRateLimit.mockResolvedValue({ allowed: true } as never);
  db.userFindMany.mockResolvedValue([
    { id: "user-1", email: "a@b.c" },
    { id: "user-2", email: "d@e.f" },
  ] as never);
});

describe("POST /api/admin/notifications/bulk (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost({ title: "T", message: "M" });
    expect(res.status).toBe(401);
  });

  it("400 si titre ou message manquant", async () => {
    const res = await callPost({ title: "T" });
    expect(res.status).toBe(400);
    expect(db.userFindMany).not.toHaveBeenCalled();
  });

  it("404 si aucun candidat", async () => {
    db.userFindMany.mockResolvedValue([] as never);
    const res = await callPost({ title: "T", message: "M" });
    expect(res.status).toBe(404);
  });

  it("envoie la notification à tous les candidats", async () => {
    const res = await callPost({ title: "T", message: "M" });
    expect(res.status).toBe(200);
    expect(db.userFindMany).toHaveBeenCalled();
  });
});