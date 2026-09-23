import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: db.findMany, count: db.count },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAdminUser: deps.getAdminUser,
}));

import { GET as listUsers } from "../../app/api/users/route";

const ADMIN = { id: "admin-1", role: "ADMIN" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue(ADMIN);
  db.findMany.mockResolvedValue([]);
  db.count.mockResolvedValue(0);
});

function get(url: string) {
  return listUsers(new Request(`http://localhost${url}`));
}

describe("GET /api/users — filtres & tri (Phase 1)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await get("/api/users");
    expect(res.status).toBe(401);
  });

  it("200 par défaut : tri createdAt desc, page 1", async () => {
    const res = await get("/api/users");
    expect(res.status).toBe(200);
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      }),
    );
    const body = await res.json();
    expect(body.meta).toMatchObject({ page: 1 });
  });

  it("transmet status + role + verified + tri au where/orderBy", async () => {
    const res = await get(
      "/api/users?status=BLOCKED&role=admin&verified=false&sort=name&direction=asc",
    );
    expect(res.status).toBe(200);
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "BLOCKED",
          role: "admin",
          emailVerified: null,
        }),
        orderBy: { name: "asc" },
      }),
    );
  });

  it("verified=true filtre les emails vérifiés (not null)", async () => {
    await get("/api/users?verified=true");
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          emailVerified: { not: null },
        }),
      }),
    );
  });

  it("from/to filtrent createdAt", async () => {
    await get(
      "/api/users?from=2026-09-01T00:00:00.000Z&to=2026-09-30T00:00:00.000Z",
    );
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });

  it("400 si status invalide", async () => {
    const res = await get("/api/users?status=NOPE");
    expect(res.status).toBe(400);
  });

  it("400 si sort invalide", async () => {
    const res = await get("/api/users?sort=password");
    expect(res.status).toBe(400);
  });
});
