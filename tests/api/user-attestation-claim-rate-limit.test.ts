import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * #310 — Le claim d'attestation devient un endpoint sensible :
 * quota distribué (IP + utilisateur) et fail-closed si Redis tombe.
 */

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findUnique: db.attestationFindUnique,
      update: db.attestationUpdate,
    },
  },
}));

const deps = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { POST } from "../../app/api/user/attestations/[id]/claim/route";
import {
  memoryFallbackLimits,
  __resetInMemoryRateLimitsForTests,
} from "@/lib/rate-limit";

function callClaim(ip = "203.0.113.7") {
  const request = {
    headers: new Headers({ "x-forwarded-for": ip }),
  } as unknown as Request;
  return POST(request, { params: Promise.resolve({ id: "att-1" }) });
}

const originalLimits = { ...memoryFallbackLimits };

beforeEach(() => {
  __resetInMemoryRateLimitsForTests();
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  db.attestationFindUnique.mockResolvedValue({
    userId: "user-1",
    status: "VALIDATED",
  } as never);
  db.attestationUpdate.mockResolvedValue({ id: "att-1", status: "CLAIMED" } as never);
});

afterEach(() => {
  Object.assign(memoryFallbackLimits, originalLimits);
  vi.unstubAllEnvs();
});

describe("#310 — quota sur le claim d'attestation", () => {
  it("un claim normal passe", async () => {
    const res = await callClaim();
    expect(res.status).toBe(200);
    expect(db.attestationUpdate).toHaveBeenCalled();
  });

  it("refuse (429) au-delà du quota et ne touche plus la base", async () => {
    memoryFallbackLimits.attestationClaim = { max: 2, windowMs: 60 * 60_000 };
    for (let i = 0; i < 2; i++) {
      expect((await callClaim()).status).toBe(200);
    }
    const blocked = await callClaim();
    expect(blocked.status).toBe(429);
    expect(db.attestationUpdate).toHaveBeenCalledTimes(2);
  });

  it("compte IP ET utilisateur : changer d'IP ne repousse pas le quota", async () => {
    memoryFallbackLimits.attestationClaim = { max: 2, windowMs: 60 * 60_000 };
    await callClaim("10.0.0.1");
    await callClaim("10.0.0.2");
    const blocked = await callClaim("10.0.0.3");
    expect(blocked.status).toBe(429);
  });

  it("le spoofing de x-forwarded-for ne crée pas de nouveau seau", async () => {
    memoryFallbackLimits.attestationClaim = { max: 2, windowMs: 60 * 60_000 };
    await callClaim("1.2.3.4, 203.0.113.7");
    await callClaim("5.6.7.8, 203.0.113.7");
    expect((await callClaim("9.9.9.9, 203.0.113.7")).status).toBe(429);
  });

  it("fail-closed : sans Redis, le claim est refusé (503) en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN", "");
    const res = await callClaim();
    expect(res.status).toBe(503);
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("le quota s'applique après l'authentification (401 si pas de session)", async () => {
    memoryFallbackLimits.attestationClaim = { max: 1, windowMs: 60 * 60_000 };
    deps.getCurrentUser.mockResolvedValue(null as never);
    expect((await callClaim()).status).toBe(401);
  });
});
