import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  contactFindMany: vi.fn(),
  contactCount: vi.fn(),
  contactUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: {
      findMany: db.contactFindMany,
      count: db.contactCount,
      update: db.contactUpdate,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET, PATCH } from "../../app/api/admin/contacts/route";

function callGet(query = "") {
  return GET(new Request(`http://localhost/api/admin/contacts${query}`));
}

function callPatch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/admin/contacts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.contactFindMany.mockResolvedValue([{ id: "c1", status: "UNREAD" }] as never);
  db.contactCount.mockResolvedValue(1);
  db.contactUpdate.mockResolvedValue({ id: "c1", status: "READ" } as never);
});

describe("GET /api/admin/contacts (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("pagination + total", async () => {
    const res = await callGet("?limit=10&offset=5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contacts).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(db.contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 5 }),
    );
  });

  it("filtre par status et type", async () => {
    await callGet("?status=UNREAD&type=CONTACT");
    expect(db.contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "UNREAD", type: "CONTACT" } }),
    );
  });
});

describe("PATCH /api/admin/contacts (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPatch({ id: "c1", status: "READ" });
    expect(res.status).toBe(401);
  });

  it("met à jour le statut", async () => {
    const res = await callPatch({ id: "c1", status: "READ" });
    expect(res.status).toBe(200);
    expect(db.contactUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" } }),
    );
  });
});