import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  notificationFindMany: vi.fn(),
  notificationCount: vi.fn(),
  notificationUpdateMany: vi.fn(),
  notificationUpdate: vi.fn(),
  notificationCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: db.notificationFindMany,
      count: db.notificationCount,
      updateMany: db.notificationUpdateMany,
      update: db.notificationUpdate,
      create: db.notificationCreate,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  pusherTrigger: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
vi.mock("@/lib/pusher", () => ({
  pusherServer: { trigger: deps.pusherTrigger },
}));

import { GET, PATCH } from "../../app/api/user/notifications/route";

function callGet() {
  return GET(new Request("http://localhost/api/user/notifications"));
}

function callPatch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/user/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  db.notificationFindMany.mockResolvedValue([
    { id: "n1", title: "Bienvenue", isRead: false },
  ] as never);
  db.notificationCount.mockResolvedValue(3 as never);
  db.notificationUpdateMany.mockResolvedValue({ count: 3 } as never);
  db.notificationUpdate.mockResolvedValue({ id: "n1", isRead: true } as never);
});

describe("GET /api/user/notifications (#138)", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("retourne les notifications + compteur non lues", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(1);
    expect(body.unreadCount).toBe(3);
  });
});

describe("PATCH /api/user/notifications (#138)", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callPatch({ markAllRead: true });
    expect(res.status).toBe(401);
  });

  it("markAllRead → marque toutes les non lues", async () => {
    const res = await callPatch({ markAllRead: true });
    expect(res.status).toBe(200);
    expect(db.notificationUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isRead: false },
      data: { isRead: true },
    });
  });

  it("notificationId → marque une notification", async () => {
    const res = await callPatch({ notificationId: "n1" });
    expect(res.status).toBe(200);
    expect(db.notificationUpdate).toHaveBeenCalledWith({
      where: { id: "n1", userId: "user-1" },
      data: { isRead: true },
    });
  });

  it("400 si paramètres invalides", async () => {
    const res = await callPatch({});
    expect(res.status).toBe(400);
  });
});