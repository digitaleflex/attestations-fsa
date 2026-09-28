import { Redis } from "@upstash/redis";
import { captureServerError } from "@/lib/observability/sentry-capture";

let redis: Redis | null = null;
let redisReady = false;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    redisReady = true;
  }
} catch (error) {
  console.error("[REDIS INIT ERROR]", error);
}

export function getRedis(): Redis | null {
  return redis;
}

export function isRedisReady(): boolean {
  return redisReady;
}

// ============================================================================
// #310 — Alerte structurée quand Redis est indisponible
// ============================================================================
// Les endpoints sensibles (auth, claim, upload) sont désormais fail-closed :
// une panne Redis y provoque un 503. Sans alerte, cette panne serait
// INDÉTECTABLE (aucun 5xx côté métier, seulement des refus). On émet donc un
// log JSON exploitable + une remontée Sentry, le tout THROTTLÉ à une fois par
// minute pour ne pas noyer les logs pendant une panne prolongée.

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
    // Les endpoints sensibles refusent le trafic : l'incident est visible.
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
