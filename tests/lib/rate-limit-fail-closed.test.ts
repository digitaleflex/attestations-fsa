import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * #310 — Rate limiting fail-closed et distribué.
 *
 * Avant : quand Redis était absent ou en erreur, `applyRateLimit` basculait sur
 * un compteur EN MÉMOIRE (fail-OPEN, et non partagé entre instances).
 * Après : sur les endpoints sensibles (auth, claim, upload), l'indisponibilité
 * de Redis REFUSE la requête (503) au lieu de laisser passer.
 */

const redisDeps = vi.hoisted(() => ({
  getRedis: vi.fn<() => unknown>(() => null),
  isRedisReady: vi.fn<() => boolean>(() => false),
  reportRedisUnavailable: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getRedis: redisDeps.getRedis,
  isRedisReady: redisDeps.isRedisReady,
  reportRedisUnavailable: redisDeps.reportRedisUnavailable,
}));

vi.mock("@upstash/ratelimit", () => {
  // Limiteur Redis simulé : l'instance "Upstash" existe mais `limit()` échoue
  // (panne réseau / timeout / quota épuisé côté Upstash).
  class FailingRatelimit {
    analytics = true;
    prefix = "test";
    constructor(public limiter: unknown) {}
    async limit() {
      throw new Error("Upstash indisponible (ECONNRESET)");
    }
  }
  return {
    Ratelimit: Object.assign(FailingRatelimit, {
      slidingWindow: (limit: number, window: string) => ({ limit, window }),
    }),
  };
});


import {
  applyByteQuotaByUser,
  applyRateLimit,
  applyRateLimitByUser,
  checkInMemoryByteLimit,
  isFailClosedLimitType,
  memoryFallbackLimits,
  __resetInMemoryRateLimitsForTests,
} from "@/lib/rate-limit";

function makeRequest(ip = "203.0.113.7"): Request {
  return {
    headers: new Headers({ "x-forwarded-for": ip }),
  } as unknown as Request;
}

/** Mode production : fail-closed par défaut, pas d'opt-out de développement. */
function asProduction() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("RATE_LIMIT_FAIL_OPEN", "");
}

beforeEach(() => {
  __resetInMemoryRateLimitsForTests();
  redisDeps.reportRedisUnavailable.mockClear();
  redisDeps.getRedis.mockReset().mockReturnValue(null);
  redisDeps.isRedisReady.mockReset().mockReturnValue(false);
  vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("#310 — classification fail-closed", () => {
  it("auth, claim et upload sont fail-closed", () => {
    for (const type of [
      "login",
      "register",
      "adminLogin",
      "passwordReset",
      "fsaOtpRequest",
      "fsaOtpVerify",
      "emailVerification",
      "authEndpoint",
      "attestationClaim",
      "upload",
      "uploadBytes",
    ] as const) {
      expect(isFailClosedLimitType(type)).toBe(true);
    }
  });

  it("les endpoints non sensibles restent tolérants (comportement inchangé)", () => {
    for (const type of [
      "api",
      "examRead",
      "examStart",
      "contact",
      "verify",
    ] as const) {
      expect(isFailClosedLimitType(type)).toBe(false);
    }
  });
});

describe("#310 — Redis non configuré sur endpoint sensible => 503", () => {
  beforeEach(asProduction);

  it("refuse le login (fail-closed) au lieu de passer en mémoire", async () => {
    const res = await applyRateLimit(makeRequest(), "login");
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.response.status).toBe(503);
      const body = await res.response.json();
      expect(body.code).toBe("RATE_LIMIT_UNAVAILABLE");
    }
  });

  it("refuse l'upload et le claim d'attestation", async () => {
    const upload = await applyRateLimit(makeRequest(), "upload");
    expect(upload.allowed).toBe(false);

    const claim = await applyRateLimitByUser(
      makeRequest(),
      "user-1",
      "attestationClaim",
    );
    expect(claim.allowed).toBe(false);
  });

  it("le fallback mémoire n'est PAS un chemin fail-open ici", async () => {
    // Preuve directe : le compteur mémoire n'a rien consommé, la requête est
    // refusée à chaque fois (et non binge sur un budget local).
    const first = await applyRateLimit(makeRequest(), "login");
    const second = await applyRateLimit(makeRequest(), "login");
    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
  });

  it("signale l'indisponibilité à l'observabilité", async () => {
    await applyRateLimit(makeRequest(), "login");
    expect(redisDeps.reportRedisUnavailable).toHaveBeenCalled();
  });

  it("les endpoints non sensibles conservent le fallback mémoire (aucun 503)", async () => {
    const res = await applyRateLimit(makeRequest(), "api");
    expect(res.allowed).toBe(true);
  });

  it("l'opt-out de développement est explicite et documenté", async () => {
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN", "true");
    const res = await applyRateLimit(makeRequest(), "login");
    expect(res.allowed).toBe(true);
  });
});

describe("#310 — Redis en panne (limiteur qui throw) => 503", () => {
  beforeEach(() => {
    asProduction();
    redisDeps.getRedis.mockReturnValue({});
    redisDeps.isRedisReady.mockReturnValue(true);
  });

  it("refuse au lieu de basculer en fail-open sur l'auth", async () => {
    const res = await applyRateLimit(makeRequest(), "login");
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.response.status).toBe(503);
  });

  it("refuse également le double comptage IP + utilisateur", async () => {
    const res = await applyRateLimitByUser(makeRequest(), "user-1", "login");
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.response.status).toBe(503);
  });

  it("refuse le quota de débit d'upload quand Redis tombe", async () => {
    const res = await applyByteQuotaByUser(
      makeRequest(),
      "user-1",
      1024,
      "uploadBytes",
    );
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.response.status).toBe(503);
  });

  it("conserve le fallback mémoire pour les endpoints non sensibles", async () => {
    const res = await applyRateLimit(makeRequest(), "contact");
    expect(res.allowed).toBe(true);
  });
});

describe("#310 — quota de débit (upload) distribué", () => {
  /**
   * `ratelimitEnabled` est figé au chargement du module : pour tester le chemin
   * « Redis disponible et fonctionnel », on réimporte le module avec un faux
   * client Redis opérationnel.
   */
  async function importWithWorkingRedis(fakeRedis: unknown) {
    vi.resetModules();
    redisDeps.getRedis.mockReturnValue(fakeRedis);
    redisDeps.isRedisReady.mockReturnValue(true);
    return import("@/lib/rate-limit");
  }

  it("le quota mémoire additionne les octets de la fenêtre", () => {
    expect(checkInMemoryByteLimit("b:1", 100, 60_000, 60, 0).success).toBe(true);
    expect(checkInMemoryByteLimit("b:1", 100, 60_000, 40, 10).success).toBe(true);
    const third = checkInMemoryByteLimit("b:1", 100, 60_000, 1, 20);
    expect(third.success).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("déclare un budget d'octets pour l'upload", () => {
    expect(memoryFallbackLimits.uploadBytes.max).toBeGreaterThan(1024 * 1024);
  });

  it("compte via Redis (INCRBY) quand le backend est disponible", async () => {
    const keys: string[] = [];
    const mod = await importWithWorkingRedis({
      incrby: vi.fn(async (key: string) => {
        keys.push(key);
        return 10;
      }),
      ttl: vi.fn(async () => 3600),
      expire: vi.fn(async () => 1),
    });

    const res = await mod.applyByteQuotaByUser(
      makeRequest(),
      "user-1",
      10,
      "uploadBytes",
    );
    expect(res.allowed).toBe(true);
    expect(keys).toContain("ratelimit:bytes:uploadBytes:user:user-1");
  });

  it("bloque au-delà du quota Redis avec un 429", async () => {
    const mod = await importWithWorkingRedis({
      incrby: vi.fn(async () => 10_000),
      ttl: vi.fn(async () => 60),
      expire: vi.fn(async () => 1),
    });
    mod.memoryFallbackLimits.uploadBytes = { max: 100, windowMs: 60_000 };

    const res = await mod.applyByteQuotaByUser(
      makeRequest(),
      "user-1",
      10_000,
      "uploadBytes",
    );
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.response.status).toBe(429);
  });

  it("compte les deux identités (IP et utilisateur) dans Redis", async () => {
    const keys: string[] = [];
    const mod = await importWithWorkingRedis({
      incrby: vi.fn(async (key: string) => {
        keys.push(key);
        return 10;
      }),
      ttl: vi.fn(async () => 3600),
      expire: vi.fn(async () => 1),
    });

    const res = await mod.applyByteQuotaByUser(
      makeRequest("203.0.113.7"),
      "user-1",
      10,
      "uploadBytes",
    );
    expect(res.allowed).toBe(true);
    expect(keys).toEqual([
      "ratelimit:bytes:uploadBytes:ip:203.0.113.7",
      "ratelimit:bytes:uploadBytes:user:user-1",
    ]);
  });
});
