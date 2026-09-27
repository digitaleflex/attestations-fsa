// tests/security/account-status.test.ts
// #304 — Le statut de compte (UserStatus) était écrit par l'admin mais jamais
// lu : un compte BLOCKED / SUSPENDED conservait sa session active. Ces tests
// verrouillent l'application EFFECTIVE du statut (login, refresh, routes) et
// la révocation des sessions.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  rawPrisma: {},
  prisma: {
    user: { findUnique: db.userFindUnique, update: db.userUpdate },
    session: { deleteMany: db.sessionDeleteMany },
  },
  default: {},
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import {
  BLOCKING_STATUSES,
  accountBlockMessage,
  enforceAccountStatus,
  evaluateAccountAccess,
  getAccountAccessByEmail,
  isAccountAllowed,
  isBlockingStatus,
  revokeUserSessions,
} from "@/lib/account-status";
import { auth, getAdminUser, getCurrentUser, guardSessionCreation } from "@/lib/auth";

const NOW = new Date("2026-09-26T10:00:00.000Z");

describe("#304 — liste des statuts bloquants", () => {
  it("liste BLOCKED et SUSPENDED", () => {
    expect([...BLOCKING_STATUSES]).toEqual(["BLOCKED", "SUSPENDED"]);
  });

  it("reconnait un statut bloquant (insensible à la casse)", () => {
    expect(isBlockingStatus("BLOCKED")).toBe(true);
    expect(isBlockingStatus("suspended")).toBe(true);
    expect(isBlockingStatus("ACTIVE")).toBe(false);
    expect(isBlockingStatus(undefined)).toBe(false);
  });
});

describe("#304 — bannissement (isAccountAllowed)", () => {
  it("autorise un compte ACTIVE", () => {
    expect(isAccountAllowed({ status: "ACTIVE" }, NOW)).toBe(true);
  });

  it("refuse un compte BLOCKED", () => {
    const decision = evaluateAccountAccess(
      { status: "BLOCKED", blockedReason: "Fraude" },
      NOW,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("BLOCKED");
    expect(accountBlockMessage(decision)).toContain("bloqué");
  });

  it("refuse un compte SUSPENDED sans date d'expiration", () => {
    const decision = evaluateAccountAccess({ status: "SUSPENDED" }, NOW);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("SUSPENDED");
  });

  it("refuse un compte banned (plugin admin Better Auth)", () => {
    const decision = evaluateAccountAccess(
      { status: "ACTIVE", banned: true, banReason: "Abus" },
      NOW,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("BANNED");
  });
});

describe("#304 — expiration de la suspension", () => {
  it("réautorise une suspension dont la date est dépassée", () => {
    const decision = evaluateAccountAccess(
      { status: "SUSPENDED", banExpires: new Date("2026-09-20T10:00:00.000Z") },
      NOW,
    );

    expect(decision.allowed).toBe(true);
    expect(decision.expired).toBe(true);
    expect(decision.reason).toBe("SUSPENDED_EXPIRED");
  });

  it("maintient le blocage tant que la suspension est en cours", () => {
    const decision = evaluateAccountAccess(
      { status: "SUSPENDED", banExpires: new Date("2026-09-27T10:00:00.000Z") },
      NOW,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.expired).toBe(false);
  });

  it("réautorise un bannissement expiré", () => {
    const decision = evaluateAccountAccess(
      {
        status: "BLOCKED",
        banned: true,
        banExpires: new Date("2026-09-01T00:00:00.000Z"),
      },
      NOW,
    );

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("SUSPENDED_EXPIRED");
  });

  it("accepte une date d'expiration sérialisée (string ISO)", () => {
    const decision = evaluateAccountAccess(
      { status: "SUSPENDED", banExpires: "2026-09-20T10:00:00.000Z" },
      NOW,
    );

    expect(decision.allowed).toBe(true);
  });
});

describe("#304 — révocation des sessions", () => {
  beforeEach(() => {
    db.sessionDeleteMany.mockReset();
    db.sessionDeleteMany.mockResolvedValue({ count: 3 });
    db.userFindUnique.mockReset();
    db.userUpdate.mockReset();
    db.userUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("supprime toutes les sessions de l'utilisateur", async () => {
    const count = await revokeUserSessions("user-1");

    expect(db.sessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(count).toBe(3);
  });

  it("révoque les sessions à la connexion d'un compte bloqué", async () => {
    db.userFindUnique.mockResolvedValue({ id: "user-1", status: "BLOCKED" });

    const decision = await enforceAccountStatus("user-1", NOW);

    expect(decision.allowed).toBe(false);
    expect(db.sessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("ne révoque rien pour un compte ACTIVE", async () => {
    db.userFindUnique.mockResolvedValue({ id: "user-1", status: "ACTIVE" });

    const decision = await enforceAccountStatus("user-1", NOW);

    expect(decision.allowed).toBe(true);
    expect(db.sessionDeleteMany).not.toHaveBeenCalled();
  });

  it("purge la suspension expirée et réautorise le compte", async () => {
    db.userFindUnique.mockResolvedValue({
      id: "user-1",
      status: "SUSPENDED",
      banned: true,
      banExpires: new Date("2026-09-20T10:00:00.000Z"),
    });

    const decision = await enforceAccountStatus("user-1", NOW);

    expect(decision.allowed).toBe(true);
    expect(db.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        status: "ACTIVE",
        banned: false,
        banReason: null,
        banExpires: null,
      },
    });
  });

  it("refuse un utilisateur inexistant", async () => {
    db.userFindUnique.mockResolvedValue(null);

    const decision = await enforceAccountStatus("inconnu", NOW);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NOT_FOUND");
  });

  it("ne casse pas l'authentification si la lecture du statut échoue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.userFindUnique.mockRejectedValue(new Error("DB indisponible"));

    const decision = await enforceAccountStatus("user-1", NOW);

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("STATUS_UNKNOWN");
  });
});

describe("#304 — recherche par e-mail (connexion FSA / OTP)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuse la connexion d'un compte bloqué trouvé par e-mail", async () => {
    db.userFindUnique.mockResolvedValue({ id: "user-9", status: "BLOCKED" });

    const decision = await getAccountAccessByEmail(
      "bloque@exemple.com",
      NOW,
    );

    expect(decision?.allowed).toBe(false);
    expect(db.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "bloque@exemple.com" } }),
    );
  });

  it("laisse passer un compte ACTIVE trouvé par e-mail", async () => {
    db.userFindUnique.mockResolvedValue({ id: "user-9", status: "ACTIVE" });

    const decision = await getAccountAccessByEmail("ok@exemple.com", NOW);

    expect(decision?.allowed).toBe(true);
  });
});

describe("#304 — blocage de la création de session (connexion)", () => {
  beforeEach(() => {
    db.userFindUnique.mockReset();
    db.sessionDeleteMany.mockReset();
    db.sessionDeleteMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuse la création de session d'un compte bloqué", async () => {
    db.userFindUnique.mockResolvedValue({ id: "u1", status: "BLOCKED" });

    await expect(guardSessionCreation({ userId: "u1" })).rejects.toThrow(
      /bloqué/,
    );
    // Les sessions déjà ouvertes sont révoquées.
    expect(db.sessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });

  it("laisse créer la session d'un compte ACTIVE", async () => {
    db.userFindUnique.mockResolvedValue({ id: "u1", status: "ACTIVE" });

    await expect(guardSessionCreation({ userId: "u1" })).resolves.toBeUndefined();
    expect(db.sessionDeleteMany).not.toHaveBeenCalled();
  });
});

describe("#304 — blocage des routes via lib/auth", () => {
  beforeEach(() => {
    db.userFindUnique.mockReset();
    db.sessionDeleteMany.mockReset();
    db.sessionDeleteMany.mockResolvedValue({ count: 1 });
    db.userUpdate.mockReset();
    db.userUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeRequest(): Request {
    return { headers: new Headers() } as Request;
  }

  it("getCurrentUser renvoie null pour un compte bloqué", async () => {
    db.userFindUnique.mockResolvedValue({ id: "u1", status: "BLOCKED" });
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "u1", email: "b@exemple.com", role: "user" },
      session: { id: "s1", userId: "u1", expiresAt: NOW },
    } as never);

    expect(await getCurrentUser(makeRequest())).toBeNull();
    expect(db.sessionDeleteMany).toHaveBeenCalled();
  });

  it("getCurrentUser renvoie null pour une suspension en cours", async () => {
    db.userFindUnique.mockResolvedValue({
      id: "u1",
      status: "SUSPENDED",
      banExpires: new Date("2026-12-01T00:00:00.000Z"),
    });
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "u1", email: "s@exemple.com", role: "user" },
      session: { id: "s1", userId: "u1", expiresAt: NOW },
    } as never);

    expect(await getCurrentUser(makeRequest())).toBeNull();
  });

  it("laisse passer un utilisateur ACTIVE (non-régression E2E)", async () => {
    db.userFindUnique.mockResolvedValue({ id: "u1", status: "ACTIVE" });
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "u1", email: "u@exemple.com", name: "Candidat", role: "user" },
      session: { id: "s1", userId: "u1", expiresAt: NOW },
    } as never);

    const user = await getCurrentUser(makeRequest());
    expect(user).not.toBeNull();
    expect(user?.id).toBe("u1");
  });

  it("getAdminUser renvoie null pour un admin bloqué", async () => {
    db.userFindUnique.mockResolvedValue({ id: "admin-1", status: "BLOCKED" });
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "admin-1", email: "a@exemple.com", role: "ADMIN" },
      session: { id: "s2", userId: "admin-1", expiresAt: NOW },
    } as never);

    expect(await getAdminUser(makeRequest())).toBeNull();
  });

  it("getAdminUser laisse passer un admin ACTIVE (non-régression E2E)", async () => {
    db.userFindUnique.mockResolvedValue({ id: "admin-1", status: "ACTIVE" });
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "admin-1", email: "a@exemple.com", role: "ADMIN" },
      session: { id: "s2", userId: "admin-1", expiresAt: NOW },
    } as never);

    const admin = await getAdminUser(makeRequest());
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe("admin");
  });
});
