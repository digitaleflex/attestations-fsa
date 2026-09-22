import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  userUpdate: vi.fn(),
  formationFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: db.userUpdate },
    formation: { findUnique: db.formationFindUnique },
  },
}));

const deps = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { POST } from "../../app/api/user/after-signup/route";
import { makeRequest } from "../helpers/request";

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  db.userUpdate.mockResolvedValue({ id: "user-1" } as never);
  db.formationFindUnique.mockResolvedValue({ id: "formation-1" } as never);
});

describe("POST /api/user/after-signup", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ phone: "+237600000000" }));
    expect(res.status).toBe(401);
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("400 si la date de naissance est invalide", async () => {
    const res = await POST(makeRequest({ birthDate: "pas-une-date" }));
    expect(res.status).toBe(400);
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("404 si la formation est introuvable", async () => {
    db.formationFindUnique.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ formationId: "formation-x" }));
    expect(res.status).toBe(404);
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("200 sans rien à mettre à jour", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Aucune donnée à mettre à jour");
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("met à jour les champs fournis", async () => {
    const res = await POST(
      makeRequest({
        phone: "+237600000000",
        birthPlace: "Douala",
        address: "Rue 1",
        formationId: "formation-1",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Profil mis à jour");
    expect(db.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        phone: "+237600000000",
        birthPlace: "Douala",
        address: "Rue 1",
        formationId: "formation-1",
      }),
    });
  });

  it("500 si la mise à jour échoue", async () => {
    db.userUpdate.mockRejectedValue(new Error("db down") as never);
    const res = await POST(makeRequest({ phone: "+237600000000" }));
    expect(res.status).toBe(500);
  });
});
