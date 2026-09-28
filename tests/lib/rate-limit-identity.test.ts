import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * #287 — Identité client fiable pour le rate limiting.
 *
 * Un `x-forwarded-for` accepté tel quel est contournable : l'attaquant forge un
 * en-tête et repart avec un compteur neuf à chaque requête. On ne retient donc
 * que la partie de la chaîne écrite par un PROXY DE CONFIANCE
 * (`TRUSTED_PROXY_HOPS`, lecture depuis la droite).
 */

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => null),
  isRedisReady: vi.fn(() => false),
}));

import {
  getClientIdentity,
  getClientIp,
  getSessionBucket,
  getTrustedProxyHops,
} from "@/lib/api-auth";
import {
  applyRateLimit,
  applyRateLimitByUser,
  memoryFallbackLimits,
  __resetInMemoryRateLimitsForTests,
} from "@/lib/rate-limit";

function makeRequest(headers: Record<string, string>): Request {
  return { headers: new Headers(headers) } as unknown as Request;
}

beforeEach(() => {
  __resetInMemoryRateLimitsForTests();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("#287 — frontière de confiance X-Forwarded-For", () => {
  it("lit le nombre de proxies de confiance depuis l'environnement (1 par défaut)", () => {
    expect(getTrustedProxyHops()).toBe(1);
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(getTrustedProxyHops()).toBe(2);
  });

  it("retient le SAUT DEPUIS LA DROITE de la chaîne XFF (spoofing ignoré)", () => {
    // 1 proxy de confiance : la dernière valeur est celle écrite par le proxy.
    const req = makeRequest({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("ignore totalement XFF quand aucun proxy n'est déclaré de confiance", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
    const spoofed = makeRequest({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIdentity(spoofed).trusted).toBe(false);
    expect(getClientIp(spoofed)).toBe("unknown");
  });

  it("repli sur l'en-tête réécrit par le CDN, jamais sur un en-tête client", () => {
    // `cf-connecting-ip` est écrasé par Cloudflare : il n'est pas spoofable
    // depuis l'extérieur, contrairement à `x-real-ip` laissé de côté.
    const req = makeRequest({ "cf-connecting-ip": "198.51.100.4" });
    expect(getClientIp(req)).toBe("198.51.100.4");

    const spoofable = makeRequest({ "x-real-ip": "8.8.8.8" });
    expect(getClientIp(spoofable)).toBe("unknown");
  });

  it("rejette une valeur d'en-tête au forme atypique (pas d'injection de clé)", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, ip:user:admin*" });
    expect(getClientIp(req)).toBe("unknown");
  });

  it("conserve un seul XFF comme identité (cas d'un proxy unique)", () => {
    expect(getClientIp(makeRequest({ "x-forwarded-for": "203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });
});

describe("#287 — le spoofing ne crée pas de nouveau compteur", () => {
  it("un attaquant qui fait tourner la partie gauche de XFF reste sur le même seau", async () => {
    const max = memoryFallbackLimits.login.max;
    // Le proxy ajoute toujours l'IP réelle en fin de chaîne : le client ne peut
    // pas la changer, donc le seau ne bouge pas.
    for (let i = 0; i < max; i++) {
      const req = makeRequest({ "x-forwarded-for": `10.0.0.${i}, 203.0.113.7` });
      const res = await applyRateLimit(req, "login");
      expect(res.allowed).toBe(true);
    }
    const blocked = await applyRateLimit(
      makeRequest({ "x-forwarded-for": "172.16.99.99, 203.0.113.7" }),
      "login",
    );
    expect(blocked.allowed).toBe(false);
  });

  it("deux clients distintos derrière le proxy ont bien des seaux distincts", async () => {
    for (let i = 0; i < memoryFallbackLimits.login.max; i++) {
      await applyRateLimit(
        makeRequest({ "x-forwarded-for": "203.0.113.7" }),
        "login",
      );
    }
    const other = await applyRateLimit(
      makeRequest({ "x-forwarded-for": "203.0.113.8" }),
      "login",
    );
    expect(other.allowed).toBe(true);
  });
});

describe("#287 — double comptage IP + utilisateur sur l'auth", () => {
  it("le seau utilisateur bloque même en changeant d'IP", async () => {
    const max = memoryFallbackLimits.login.max;
    const cookie = "better-auth.session_token=abcdef-session-value";
    for (let i = 0; i < max; i++) {
      const res = await applyRateLimitByUser(
        makeRequest({ "x-forwarded-for": `10.1.0.${i}`, cookie }),
        getSessionBucket(makeRequest({ cookie })),
        "login",
      );
      expect(res.allowed).toBe(true);
    }
    const blocked = await applyRateLimitByUser(
      makeRequest({ "x-forwarded-for": "10.1.0.250", cookie }),
      getSessionBucket(makeRequest({ cookie })),
      "login",
    );
    expect(blocked.allowed).toBe(false);
  });

  it("le seau session est stable, opaque et sans valeur de cookie en clair", () => {
    const a = getSessionBucket(makeRequest({ cookie: "better-auth.session_token=secret-token-value" }));
    const b = getSessionBucket(
      makeRequest({ cookie: "__Secure-better-auth.session_token=secret-token-value" }),
    );
    expect(a).toBe(b);
    expect(a).toMatch(/^sess:[0-9a-f]{8}$/);
    expect(a).not.toContain("secret");
  });

  it("sans cookie de session, l'anonyme est son propre seau", () => {
    expect(getSessionBucket(makeRequest({}))).toBe("sess:anonymous");
  });
});
