import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => null),
  isRedisReady: vi.fn(() => false),
}));

import {
  applyRateLimit,
  applyRateLimitByUser,
  checkInMemoryLimit,
  memoryFallbackLimits,
  rateLimits,
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

// #256 — budgets des points d'entrée sensibles du flux examen.
describe("rate-limit du flux examen (#256)", () => {
  beforeEach(() => {
    __resetInMemoryRateLimitsForTests();
  });

  it("déclare un budget pour chaque point d'entrée du flux", () => {
    for (const key of ["examRead", "examStart", "examDraft"] as const) {
      expect(rateLimits).toHaveProperty(key);
      expect(memoryFallbackLimits[key]).toBeDefined();
    }
  });

  it("calibre examDraft au-dessus du rythme nominal du client (15 s)", () => {
    // 1h / 15 s = 240 appels légitimes : la limite doit rester au-dessus.
    const { max, windowMs } = memoryFallbackLimits.examDraft;
    expect(max).toBeGreaterThanOrEqual((windowMs / 1000 / 15) * 1.2);
  });

  it("bloque la lecture d'un examen au-delà du budget (mémoire)", async () => {
    for (let i = 0; i < memoryFallbackLimits.examRead.max; i++) {
      const ok = await applyRateLimit(makeRequest("5.5.5.5"), "examRead");
      expect(ok.allowed).toBe(true);
    }
    const blocked = await applyRateLimit(makeRequest("5.5.5.5"), "examRead");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.response.status).toBe(429);
  });

  it("bloque le démarrage d'examen par utilisateur même en changeant d'IP", async () => {
    const userId = "user-exam-start";
    const max = memoryFallbackLimits.examStart.max;
    for (let i = 0; i < max; i++) {
      const ok = await applyRateLimitByUser(
        makeRequest(`172.16.0.${i}`),
        userId,
        "examStart",
      );
      expect(ok.allowed).toBe(true);
    }
    const blocked = await applyRateLimitByUser(
      makeRequest("172.16.0.250"),
      userId,
      "examStart",
    );
    expect(blocked.allowed).toBe(false);
  });

  it("isole les budgets : une boucle de lecture ne bloque pas le brouillon", async () => {
    const max = memoryFallbackLimits.examRead.max;
    for (let i = 0; i <= max; i++) {
      await applyRateLimit(makeRequest("6.6.6.6"), "examRead");
    }
    const draft = await applyRateLimitByUser(
      makeRequest("6.6.6.6"),
      "user-brouillon",
      "examDraft",
    );
    expect(draft.allowed).toBe(true);
  });
});
