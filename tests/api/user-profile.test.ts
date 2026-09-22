import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  examSessionFindFirst: vi.fn(),
  attestationFindFirst: vi.fn(),
  accountUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: db.userFindUnique,
      findFirst: db.userFindFirst,
      update: db.userUpdate,
    },
    examSession: { findFirst: db.examSessionFindFirst },
    attestation: { findFirst: db.attestationFindFirst },
    account: { updateMany: db.accountUpdateMany },
  },
}));

const authDeps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  changePassword: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: authDeps.getCurrentUser,
  auth: { api: { changePassword: authDeps.changePassword } },
}));

const cryptoDeps = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: cryptoDeps.hashPassword,
  verifyPassword: cryptoDeps.verifyPassword,
}));

import { GET, PATCH } from "../../app/api/user/profile/route";
import { makeRequest } from "../helpers/request";

function callGet() {
  return GET(makeRequest({}));
}

function callPatch(body: unknown) {
  return PATCH(makeRequest(body));
}

beforeEach(() => {
  vi.clearAllMocks();
  authDeps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  authDeps.changePassword.mockResolvedValue(undefined as never);
  db.userFindUnique.mockResolvedValue({
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    role: "user",
  } as never);
  db.userFindFirst.mockResolvedValue(null as never);
  db.userUpdate.mockResolvedValue({
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
  } as never);
  db.examSessionFindFirst.mockResolvedValue(null as never);
  db.attestationFindFirst.mockResolvedValue(null as never);
  db.accountUpdateMany.mockResolvedValue({ count: 1 } as never);
  cryptoDeps.hashPassword.mockResolvedValue("hashed-new" as never);
  cryptoDeps.verifyPassword.mockResolvedValue(true as never);
});

describe("GET /api/user/profile", () => {
  it("401 si non authentifié", async () => {
    authDeps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("404 si l'utilisateur n'existe pas", async () => {
    db.userFindUnique.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  it("200 renvoie le profil", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("user-1");
  });
});

describe("PATCH /api/user/profile", () => {
  it("401 si non authentifié", async () => {
    authDeps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callPatch({ phone: "+237600000000" });
    expect(res.status).toBe(401);
  });

  it("400 si le payload est invalide", async () => {
    const res = await callPatch({ name: "A" });
    expect(res.status).toBe(400);
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("403 si l'identité est verrouillée par un historique officiel", async () => {
    db.examSessionFindFirst.mockResolvedValue({ id: "sess-1" } as never);
    const res = await callPatch({ name: "Alice Martin" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("IDENTITY_LOCKED");
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("400 si l'email est déjà utilisé", async () => {
    db.userFindFirst.mockResolvedValue({ id: "other" } as never);
    const res = await callPatch({ email: "taken@example.com" });
    expect(res.status).toBe(400);
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("200 met à jour les champs simples", async () => {
    const res = await callPatch({ phone: "+237600000000", address: "Rue 2" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("user-1");
    expect(db.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ phone: "+237600000000", address: "Rue 2" }),
      }),
    );
  });

  it("200 convertit la date au format français jj/mm/aaaa", async () => {
    const res = await callPatch({ birthDate: "02/01/2000" });
    expect(res.status).toBe(200);
    expect(db.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ birthDate: new Date(2000, 0, 2, 12, 0, 0) }),
      }),
    );
  });

  it("200 change le mot de passe via Better Auth", async () => {
    const res = await callPatch({ oldPassword: "oldpass12", newPassword: "newpass12" });
    expect(res.status).toBe(200);
    expect(authDeps.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          currentPassword: "oldpass12",
          newPassword: "newpass12",
        }),
      }),
    );
  });

  it("401 si l'ancien mot de passe legacy est incorrect", async () => {
    authDeps.changePassword.mockRejectedValue(new Error("invalid") as never);
    db.userFindUnique.mockResolvedValue({
      id: "user-1",
      password: "hashed-legacy",
    } as never);
    cryptoDeps.verifyPassword.mockResolvedValue(false as never);
    const res = await callPatch({ oldPassword: "oldpass12", newPassword: "newpass12" });
    expect(res.status).toBe(401);
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("500 si la mise à jour échoue", async () => {
    db.userUpdate.mockRejectedValue(new Error("db down") as never);
    const res = await callPatch({ phone: "+237600000000" });
    expect(res.status).toBe(500);
  });
});
