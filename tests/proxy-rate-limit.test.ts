import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * #287 — Les endpoints d'authentification passent par le middleware (`proxy.ts`)
 * pour un double comptage IP + utilisateur, sans toucher `lib/auth.ts` ni le
 * gestionnaire Better Auth.
 */

import proxy from "@/proxy";
import {
  memoryFallbackLimits,
  __resetInMemoryRateLimitsForTests,
} from "@/lib/rate-limit";

const SESSION = "session-cookie-value-1234567890";

function makeRequest(
  pathname: string,
  options: { ip?: string; cookie?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {};
  if (options.ip) headers["x-forwarded-for"] = options.ip;
  if (options.cookie) headers.cookie = `better-auth.session_token=${options.cookie}`;
  return new NextRequest(`http://localhost:3000${pathname}`, { headers });
}

const originalLimits = { ...memoryFallbackLimits };

beforeEach(() => {
  __resetInMemoryRateLimitsForTests();
  vi.unstubAllEnvs();
});

afterEach(() => {
  Object.assign(memoryFallbackLimits, originalLimits);
  vi.unstubAllEnvs();
});

describe("#287 — rate limit sur /api/auth (middleware)", () => {
  it("laisse passer un appel d'auth sous le budget", async () => {
    const res = await proxy(makeRequest("/api/auth/sign-in/email", { ip: "203.0.113.7" }));
    expect(res.status).toBe(200);
  });

  it("bloque (429) les tentatives répétées sur un endpoint d'auth", async () => {
    memoryFallbackLimits.authEndpoint = { max: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) {
      const ok = await proxy(makeRequest("/api/auth/sign-in/email", { ip: "203.0.113.7" }));
      expect(ok.status).toBe(200);
    }
    const blocked = await proxy(makeRequest("/api/auth/sign-in/email", { ip: "203.0.113.7" }));
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toMatchObject({
      code: "RATE_LIMIT_EXCEEDED",
    });
  });

  it("double comptage : la même session est bloquée même en changeant d'IP", async () => {
    memoryFallbackLimits.authEndpoint = { max: 2, windowMs: 60_000 };
    await proxy(makeRequest("/api/auth/sign-in/email", { ip: "10.0.0.1", cookie: SESSION }));
    await proxy(makeRequest("/api/auth/sign-in/email", { ip: "10.0.0.2", cookie: SESSION }));
    const blocked = await proxy(
      makeRequest("/api/auth/sign-in/email", { ip: "10.0.0.3", cookie: SESSION }),
    );
    expect(blocked.status).toBe(429);
  });

  it("le spoofing de x-forwarded-for ne crée pas de nouveau budget", async () => {
    memoryFallbackLimits.authEndpoint = { max: 2, windowMs: 60_000 };
    await proxy(makeRequest("/api/auth/sign-in/email", { ip: "1.1.1.1, 203.0.113.7" }));
    await proxy(makeRequest("/api/auth/sign-in/email", { ip: "2.2.2.2, 203.0.113.7" }));
    const blocked = await proxy(
      makeRequest("/api/auth/sign-in/email", { ip: "3.3.3.3, 203.0.113.7" }),
    );
    expect(blocked.status).toBe(429);
  });

  it("laisse /api/auth/fsa-login à son propre quota (déjà IP + code)", async () => {
    memoryFallbackLimits.authEndpoint = { max: 1, windowMs: 60_000 };
    await proxy(makeRequest("/api/auth/fsa-login", { ip: "203.0.113.7" }));
    const second = await proxy(makeRequest("/api/auth/fsa-login", { ip: "203.0.113.7" }));
    expect(second.status).toBe(200);
  });

  it("fail-closed : sans Redis, l'auth est refusée (503) en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN", "");
    const res = await proxy(makeRequest("/api/auth/sign-in/email", { ip: "203.0.113.7" }));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: "RATE_LIMIT_UNAVAILABLE",
    });
  });

  it("ne touche pas aux routes non concernées par l'auth", async () => {
    memoryFallbackLimits.authEndpoint = { max: 1, windowMs: 60_000 };
    for (let i = 0; i < 5; i++) {
      const res = await proxy(makeRequest("/a-propos", { ip: "203.0.113.7" }));
      expect(res.status).toBe(200);
    }
  });
});
