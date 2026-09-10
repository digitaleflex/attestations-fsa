import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => null),
  isRedisReady: vi.fn(() => false),
}));

import {
  applyRateLimit,
  applyRateLimitByUser,
  checkInMemoryLimit,
  __resetInMemoryRateLimitsForTests,
} from "@/lib/rate-limit";

function makeRequest(ip = "1.2.3.4"): Request {
  return {
    headers: new Headers({ "x-forwarded-for": ip }),
  } as unknown as Request;
}

describe("rate-limit fallback mémoire", () => {
  beforeEach(() => {
    __resetInMemoryRateLimitsForTests();
    vi.restoreAllMocks();
  });

  it("checkInMemoryLimit autorise jusqu'au max puis bloque", () => {
    const key = "test:login";
    for (let i = 0; i < 5; i++) {
      const r = checkInMemoryLimit(key, 5, 60_000, 1_000 + i);
      expect(r.success).toBe(true);
    }
    const blocked = checkInMemoryLimit(key, 5, 60_000, 1_010);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("expire la fenêtre glissante après windowMs", () => {
    const key = "test:window";
    checkInMemoryLimit(key, 1, 1_000, 0);
    expect(checkInMemoryLimit(key, 1, 1_000, 500).success).toBe(false);
    expect(checkInMemoryLimit(key, 1, 1_000, 1_001).success).toBe(true);
  });

  it("applyRateLimit utilise le fallback quand Redis est indisponible (login: 5 max)", async () => {
    // 5 premiers appels autorisés
    for (let i = 0; i < 5; i++) {
      const r = await applyRateLimit(makeRequest("9.9.9.9"), "login");
      expect(r.allowed).toBe(true);
    }
    // 6e appel bloqué avec réponse 429
    const blocked = await applyRateLimit(makeRequest("9.9.9.9"), "login");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.response.status).toBe(429);
    }
  });

  it("isole les compteurs par IP", async () => {
    for (let i = 0; i < 5; i++) {
      await applyRateLimit(makeRequest("10.0.0.1"), "login");
    }
    const blockedA = await applyRateLimit(makeRequest("10.0.0.1"), "login");
    expect(blockedA.allowed).toBe(false);

    const okB = await applyRateLimit(makeRequest("10.0.0.2"), "login");
    expect(okB.allowed).toBe(true);
  });

  it("applyRateLimitByUser bloque si l'identifiant user dépasse la limite", async () => {
    const userId = "user-abc";
    for (let i = 0; i < 5; i++) {
      // Change d'IP à chaque fois pour prouver que c'est le compteur user qui bloque
      const r = await applyRateLimitByUser(
        makeRequest(`192.168.0.${i}`),
        userId,
        "login",
      );
      expect(r.allowed).toBe(true);
    }
    // Même avec une nouvelle IP, le compteur user:xxx a atteint 5
    const blocked = await applyRateLimitByUser(
      makeRequest("192.168.0.99"),
      userId,
      "login",
    );
    expect(blocked.allowed).toBe(false);
  });
});
