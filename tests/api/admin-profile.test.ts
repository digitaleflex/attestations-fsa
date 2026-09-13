import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: db.userFindUnique,
      findFirst: db.userFindFirst,
      update: db.userUpdate,
    },
    // #137 — la route PATCH utilise une transaction
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ user: { update: db.userUpdate } }),
    ),
  },
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(),
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

import { GET, PATCH } from "../../app/api/admin/route";
import { verifyPassword } from "better-auth/crypto";

const mockVerify = verifyPassword as unknown as ReturnType<typeof vi.fn>;

function callGet() {
  return GET(new Request("http://localhost/api/admin"));
}

function callPatch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/admin", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.userFindUnique.mockResolvedValue({
    id: "admin-1",
    name: "Admin",
    email: "admin@fsa.bj",
    password: "hashed-old",
  } as never);
  db.userFindFirst.mockResolvedValue(null as never);
  db.userUpdate.mockResolvedValue({ id: "admin-1", name: "Admin 2" } as never);
  mockVerify.mockResolvedValue(true);
});

describe("GET /api/admin — profil admin (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("404 si compte introuvable", async () => {
    db.userFindUnique.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  it("retourne le profil admin", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("admin@fsa.bj");
  });
});

describe("PATCH /api/admin — profil admin (#137)", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPatch({ name: "X" });
    expect(res.status).toBe(401);
  });

  it("400 si email invalide", async () => {
    const res = await callPatch({ email: "pas-un-email" });
    expect(res.status).toBe(400);
  });

  it("400 si email déjà utilisé", async () => {
    db.userFindFirst.mockResolvedValue({ id: "other" } as never);
    const res = await callPatch({ email: "pris@fsa.bj" });
    expect(res.status).toBe(400);
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("400 si mauvais ancien mot de passe", async () => {
    mockVerify.mockResolvedValue(false);
    const res = await callPatch({
      oldPassword: "oldpass123",
      newPassword: "newpass123",
    });
    expect(res.status).toBe(400);
  });

  it("met à jour le nom", async () => {
    const res = await callPatch({ name: "Admin 2" });
    expect(res.status).toBe(200);
    expect(db.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "admin-1" },
        data: expect.objectContaining({ name: "Admin 2" }),
      }),
    );
  });
});