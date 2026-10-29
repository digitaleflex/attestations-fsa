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
  get(key: string): Promise<any>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
  ping(): Promise<string>;
  eval(script: string, keys: string[], args: unknown[]): Promise<unknown>;
  evalsha(sha: string, keys: string[], args: unknown[]): Promise<any>;
  incr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

// ── Client Upstash HTTP ──────────────────────────────────────────────────────

function createUpstashClient(url: string, token: string): RedisClient {
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  // Cast nécessaire : @upstash/ratelimit attend le type Redis natif,
  // pas notre interface simplifiée.
  return new Redis({ url, token }) as any;
}

// ── Client ioredis natif ─────────────────────────────────────────────────────

/**
 * Retire l'en-tête `#!lua flags=...` d'un script avant de l'envoyer à Redis.
 *
 * ## Pourquoi
 *
 * `@upstash/ratelimit` préfixe ses scripts de `#!lua flags=allow-key-locking`.
 * Ce n'est pas du Lua : c'est une métadonnée interprétée par le serveur
 * **Upstash**. Redis standard (vérifié sur 7.4 et 8.10) la refuse :
 *
 *   ERR Unexpected flag in script shebang: allow-key-locking
 *
 * En production cloud, le client HTTP Upstash envoie le script tel quel et
 * tout va bien. En E2E et sur un Redis local, c'est ioredis qui parle
 * directement au serveur : sans ce nettoyage, CHAQUE vérification de
 * rate-limit échoue et bascule en mémoire — ce qui faisait tomber les tests
 * d'authentification (le limiteur n'était plus partagé) et, en production
 * auto-hébergée, casserait le rate-limit distribué.
 *
 * Le script nettoyé reste fonctionnel : le flag ne change pas la sémantique
 * du Lua, il autorise seulement Upstash à verrouiller des clés.
 */
export function stripUpstashShebang(script: string): string {
  return script.replace(/^#![^\n]*\n/, "");
}

/**
 * Sous-ensemble d'ioredis réellement utilisé. Permet de tester l'adaptateur
 * avec un faux client, sans dépendre de `require("ioredis")` (que `vi.mock`
 * n'intercepte pas, puisqu'il contourne le graphe de modules de Vite).
 */
export interface NativeRedisLike {
  get(key: string): Promise<unknown>;
  set(...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
  ping(): Promise<string>;
  eval(script: string, numKeys: number, ...args: unknown[]): Promise<unknown>;
  evalsha(sha: string, numKeys: number, ...args: unknown[]): Promise<unknown>;
  incr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

/**
 * Adapte un client ioredis à l'interface `RedisClient`.
 *
 * Exporté pour être testable directement : le nettoyage du shebang est la
 * seule chose qui empêche `@upstash/ratelimit` de casser sur un Redis
 * standard, et on veut le prouver sans monter une vraie instance.
 */
export function adaptNativeClient(client: NativeRedisLike): RedisClient {
  return {
    get: (key: string) => client.get(key),
    set: (key: string, value: string, ...args: unknown[]) =>
      client.set(key, value, ...args),
    del: (key: string) => client.del(key),
    ping: () => client.ping(),
    eval: (script: string, keys: string[], args: unknown[]) =>
      client.eval(stripUpstashShebang(script), keys.length, ...keys, ...args),
    evalsha: (sha: string, keys: string[], args: unknown[]) =>
      client.evalsha(sha, keys.length, ...keys, ...args),
    incr: (key: string) => client.incr(key),
    incrby: (key: string, increment: number) => client.incrby(key, increment),
    expire: (key: string, seconds: number) => client.expire(key, seconds),
    ttl: (key: string) => client.ttl(key),
  };
}

function createNativeClient(): RedisClient {
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

  return adaptNativeClient(client as unknown as NativeRedisLike);
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
}

/** Réinitialise le throttling d'alerte (réservé aux tests). */
export function __resetRedisUnavailableReportsForTests(): void {
  lastUnavailableReportAt = 0;
}
