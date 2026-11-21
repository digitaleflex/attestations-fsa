import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * #385 — `resetPasswordRequired` doit être RÉELLEMENT appliqué :
 *  - aucune session créée à la connexion tant que le mot de passe n'est pas
 *    changé ;
 *  - les sessions existantes ne peuvent plus agir (getCurrentUser → null) ;
 *  - le flag est levé uniquement après un reset OTP réussi (hook after).
 */

vi.mock("@/lib/prisma", () => ({
  rawPrisma: {
    user: { updateMany: vi.fn(async () => ({ count: 1 })) },
  },
  prisma: {},
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

const status = vi.hoisted(() => ({
  enforceAccountStatus: vi.fn(),
}));

vi.mock("@/lib/account-status", () => ({
  enforceAccountStatus: status.enforceAccountStatus,
  accountBlockMessage: () => "Compte bloqué.",
  accountBlockLogMessage: () => "[ACCOUNT_BLOCKED] test",
  getAccountAccessByEmail: vi.fn(),
  revokeUserSessions: vi.fn(),
}));

import { auth, getCurrentUser, guardSessionCreation } from "@/lib/auth";

function makeRequest(): Request {
  return { headers: new Headers() } as Request;
}

const RESET_REQUIRED = {
  allowed: true,
  status: "ACTIVE",
  reason: "ACTIVE",
  banExpires: null,
  expired: false,
  detail: null,
  user: { id: "user-1", resetPasswordRequired: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  status.enforceAccountStatus.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("#385 — resetPasswordRequired", () => {
  it("refuse la création de session à la connexion", async () => {
    status.enforceAccountStatus.mockResolvedValue(RESET_REQUIRED as never);

    await expect(
      guardSessionCreation({ userId: "user-1" }),
    ).rejects.toThrow(/changement de mot de passe est requis/i);
  });

  it("getCurrentUser retourne null pour une session antérieure au flag", async () => {
    status.enforceAccountStatus.mockResolvedValue(RESET_REQUIRED as never);
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "user",
        emailVerified: true,
      },
    } as never);

    await expect(getCurrentUser(makeRequest())).resolves.toBeNull();
  });

  it("laisse passer un compte sans reset requis", async () => {
    status.enforceAccountStatus.mockResolvedValue({
      ...RESET_REQUIRED,
      user: { id: "user-1", resetPasswordRequired: false },
    } as never);

    await expect(
      guardSessionCreation({ userId: "user-1" }),
    ).resolves.toBeUndefined();
  });
});
