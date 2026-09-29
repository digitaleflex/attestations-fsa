import { captureServerError } from "@/lib/observability/sentry-capture";

/**
 * Client Redis unifié.
 *
 * - Si UPSTASH_REDIS_REST_URL est défini → client HTTP Upstash (cloud)
 * - Sinon → client ioredis natif (Redis local sur le VPS)
 *
 * Les deux exposent la même API minimale (get/set/del/ping/eval)
 * utilisée par @upstash/ratelimit et le rate-limit applicatif.
 */

// ── Interface minimale compatible ────────────────────────────────────────────

export interface RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(key: string): Promise<any>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
  ping(): Promise<string>;
  eval(script: string, keys: string[], args: unknown[]): Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evalsha(sha: string, keys: string[], args: unknown[]): Promise<any>;
  incr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

// ── Client Upstash HTTP ──────────────────────────────────────────────────────

function createUpstashClient(url: string, token: string): RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  // Cast nécessaire : @upstash/ratelimit attend le type Redis natif,
  // pas notre interface simplifiée.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Redis({ url, token }) as any;
}

// ── Client ioredis natif ─────────────────────────────────────────────────────

function createNativeClient(): RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis = require("ioredis") as typeof import("ioredis").default;
  const client = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

  // Adapter ioredis vers l'interface RedisClient
  return {
    get: (key: string) => client.get(key),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set: (key: string, value: string, ...args: unknown[]) => client.set(key, value, ...(args as any[])),
    del: (key: string) => client.del(key),
    ping: () => client.ping(),
    eval: (script: string, keys: string[], args: unknown[]) =>
      client.eval(script, keys.length, ...keys, ...(args as string[])),
    evalsha: (sha: string, keys: string[], args: unknown[]) =>
      client.evalsha(sha, keys.length, ...keys, ...(args as string[])),
    incr: (key: string) => client.incr(key),
    incrby: (key: string, increment: number) => client.incrby(key, increment),
    expire: (key: string, seconds: number) => client.expire(key, seconds),
    ttl: (key: string) => client.ttl(key),
  };
}

// ── Initialisation ───────────────────────────────────────────────────────────

let redis: RedisClient | null = null;
let redisReady = false;

try {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (upstashUrl && upstashToken) {
    // Mode Upstash HTTP (cloud)
    redis = createUpstashClient(upstashUrl, upstashToken);
    redisReady = true;
  } else if (process.env.REDIS_HOST || process.env.NODE_ENV === "production") {
    // Mode Redis natif (VPS local)
    redis = createNativeClient();
    redisReady = true;
  }
} catch (error) {
  console.error("[REDIS INIT ERROR]", error);
}

export function getRedis(): RedisClient | null {
  return redis;
}

export function isRedisReady(): boolean {
  return redisReady;
}

// ============================================================================
// #310 — Alerte structurée quand Redis est indisponible
// ============================================================================

const REPORT_THROTTLE_MS = 60_000;
let lastUnavailableReportAt = 0;

/** Signale l'indisponibilité de Redis (panne réseau, quota épuisé, non configuré). */
export function reportRedisUnavailable(scope: string, error?: unknown): void {
  const now = Date.now();
  if (now - lastUnavailableReportAt < REPORT_THROTTLE_MS) return;
  lastUnavailableReportAt = now;

  const payload = {
    code: "REDIS_UNAVAILABLE",
    scope,
    configured: redis !== null,
    impact: "rate-limit fail-closed sur auth/claim/upload",
    timestamp: new Date(now).toISOString(),
  };

  console.error("[REDIS_UNAVAILABLE]", JSON.stringify(payload));
  captureServerError(
    error instanceof Error ? error : new Error(`Redis indisponible (${scope})`),
    payload,
  );
}

/** Réinitialise le throttling d'alerte (réservé aux tests). */
export function __resetRedisUnavailableReportsForTests(): void {
  lastUnavailableReportAt = 0;
}
