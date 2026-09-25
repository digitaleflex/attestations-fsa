import { Ratelimit } from "@upstash/ratelimit";
import { getRedis, isRedisReady } from "@/lib/redis";
import { NextResponse } from "next/server";

const redis = getRedis();
const ratelimitEnabled = isRedisReady();

// Rate limits par endpoint
export const rateLimits = {
  // Authentification - Très restrictif
  login: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 essais / 15min
        analytics: true,
        prefix: "ratelimit:login",
      })
    : null,

  // Inscription
  register: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 inscriptions / heure
        analytics: true,
        prefix: "ratelimit:register",
      })
    : null,

  // Signalement
  report: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 signalements / heure
        analytics: true,
        prefix: "ratelimit:report",
      })
    : null,

  // Vérification code
  verify: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 h"), // 10 vérifications / heure
        analytics: true,
        prefix: "ratelimit:verify",
      })
    : null,

  // API générale
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 req / minute
        analytics: true,
        prefix: "ratelimit:api",
      })
    : null,

  // Soumission examen
  submission: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 h"), // 5 submissions / heure
        analytics: true,
        prefix: "ratelimit:submission",
      })
    : null,

  // #256 — Lecture du contenu d'un examen (GET /api/exams/[id], liste candidat).
  // Le barème et les identifiants de questions ne doivent pas être
  // harvestés par un script de tries.
  examRead: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"), // 60 lectures / minute
        analytics: true,
        prefix: "ratelimit:exam-read",
      })
    : null,

  // #256 — Démarrage/reprise d'une session d'examen.
  examStart: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 h"), // 20 démarrages / heure
        analytics: true,
        prefix: "ratelimit:exam-start",
      })
    : null,

  // #256 — Synchronisation du brouillon. Le client persiste toutes les 15 s,
  // soit ~240 appels pour un examen d'une heure : la limite est calibrée au
  // dessus de ce rythme nominal, avec une garde pour la boucle runaway.
  examDraft: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(400, "1 h"), // 400 brouillons / heure
        analytics: true,
        prefix: "ratelimit:exam-draft",
      })
    : null,

  // Password reset request
  passwordReset: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 demandes / heure
        analytics: true,
        prefix: "ratelimit:password-reset",
      })
    : null,

  // Envoi email de vérification
  emailVerification: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 h"), // 5 envois / heure
        analytics: true,
        prefix: "ratelimit:email-verify",
      })
    : null,

  // Internship applications
  internship: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 candidatures / heure
        analytics: true,
        prefix: "ratelimit:internship",
      })
    : null,

  // Contact form
  contact: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 h"), // 5 messages / heure
        analytics: true,
        prefix: "ratelimit:contact",
      })
    : null,

  // FSA login — OTP request (3 demandes / 10min par IP)
  fsaOtpRequest: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "10 m"),
        analytics: true,
        prefix: "ratelimit:fsa-otp-request",
      })
    : null,

  // FSA login — OTP verify (5 essais / 15min par IP+code)
  fsaOtpVerify: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"),
        analytics: true,
        prefix: "ratelimit:fsa-otp-verify",
      })
    : null,

  // ==========================================
  // ADMIN RATE LIMITS - Sécurité renforcée
  // ==========================================

  // Admin bulk operations (attestations, users, etc.)
  adminBulk: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "5 m"), // 10 opérations / 5min
        analytics: true,
        prefix: "ratelimit:admin-bulk",
      })
    : null,

  // Admin bulk notifications
  adminNotifications: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "10 m"), // 5 envois / 10min
        analytics: true,
        prefix: "ratelimit:admin-notifications",
      })
    : null,

  // Admin settings changes
  adminSettings: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 h"), // 20 modifications / heure
        analytics: true,
        prefix: "ratelimit:admin-settings",
      })
    : null,

  // Admin login (spécifique, plus restrictif que login user)
  adminLogin: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 essais / 15min
        analytics: true,
        prefix: "ratelimit:admin-login",
      })
    : null,
};

// ============================================================================
// Fallback en mémoire (quand Redis est indisponible)
// ============================================================================
// Protège l'API même sans Redis (dev local, panne Upstash, build).
// Limites miroir de la config Redis ci-dessus. Fenêtre glissante simple.
// Note : par instance Node uniquement — Redis reste la source de vérité
// en multi-instances, mais le fallback évite le bypass total.

const MINUTE = 60_000;

export const memoryFallbackLimits: Record<
  keyof typeof rateLimits,
  { max: number; windowMs: number }
> = {
  login: { max: 5, windowMs: 15 * MINUTE },
  register: { max: 3, windowMs: 60 * MINUTE },
  report: { max: 3, windowMs: 60 * MINUTE },
  verify: { max: 10, windowMs: 60 * MINUTE },
  api: { max: 100, windowMs: 1 * MINUTE },
  submission: { max: 5, windowMs: 60 * MINUTE },
  examRead: { max: 60, windowMs: 1 * MINUTE },
  examStart: { max: 20, windowMs: 60 * MINUTE },
  examDraft: { max: 400, windowMs: 60 * MINUTE },
  passwordReset: { max: 3, windowMs: 60 * MINUTE },
  emailVerification: { max: 5, windowMs: 60 * MINUTE },
  internship: { max: 3, windowMs: 60 * MINUTE },
  contact: { max: 5, windowMs: 60 * MINUTE },
  fsaOtpRequest: { max: 3, windowMs: 10 * MINUTE },
  fsaOtpVerify: { max: 5, windowMs: 15 * MINUTE },
  adminBulk: { max: 10, windowMs: 5 * MINUTE },
  adminNotifications: { max: 5, windowMs: 10 * MINUTE },
  adminSettings: { max: 20, windowMs: 60 * MINUTE },
  adminLogin: { max: 5, windowMs: 15 * MINUTE },
};

type GlobalWithRateLimitStore = typeof globalThis & {
  __inMemoryRateLimitStore?: Map<string, number[]>;
};

function getMemoryStore(): Map<string, number[]> {
  const g = globalThis as GlobalWithRateLimitStore;
  if (!g.__inMemoryRateLimitStore) {
    g.__inMemoryRateLimitStore = new Map<string, number[]>();
  }
  return g.__inMemoryRateLimitStore;
}

/** Réinitialise le store mémoire (réservé aux tests). */
export function __resetInMemoryRateLimitsForTests() {
  getMemoryStore().clear();
}

export function checkInMemoryLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): { success: boolean; remaining: number; reset: number; limit: number } {
  const store = getMemoryStore();
  const timestamps = (store.get(key) ?? []).filter((t) => t > now - windowMs);

  if (timestamps.length >= max) {
    const oldest = timestamps[0] ?? now;
    return {
      success: false,
      remaining: 0,
      reset: oldest + windowMs,
      limit: max,
    };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return {
    success: true,
    remaining: max - timestamps.length,
    reset: now + windowMs,
    limit: max,
  };
}

function buildRateLimitExceededResponse(
  max: number,
  remaining: number,
  reset: number,
) {
  return NextResponse.json(
    {
      error: "Trop de requêtes. Veuillez réessayer plus tard.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: new Date(reset).toISOString(),
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": max.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": new Date(reset).toISOString(),
        "Retry-After": Math.max(
          0,
          Math.ceil((reset - Date.now()) / 1000),
        ).toString(),
      },
    },
  );
}

function applyMemoryFallback(
  identifier: string,
  limitType: keyof typeof rateLimits,
) {
  const config = memoryFallbackLimits[limitType];
  if (!config) {
    console.warn(`[RATE LIMIT] Type de limit inconnu: ${limitType}`);
    return {
      allowed: true,
      headers: {} as Record<string, string>,
    } as const;
  }
  const key = `memory:${limitType}:${identifier}`;
  const {
    success,
    remaining,
    reset,
    limit: max,
  } = checkInMemoryLimit(key, config.max, config.windowMs);

  if (!success) {
    return {
      allowed: false,
      response: buildRateLimitExceededResponse(max, remaining, reset),
    } as const;
  }

  return {
    allowed: true,
    headers: {
      "X-RateLimit-Limit": max.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": new Date(reset).toISOString(),
    },
  } as const;
}

// ✅ FIX: Accept Request instead of NextRequest
export async function applyRateLimit(
  request: Request,
  limitType: keyof typeof rateLimits,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = rateLimits[limitType];

  // Fallback mémoire si Redis indisponible ou limite non initialisée
  if (!ratelimitEnabled || !limit) {
    if (!ratelimitEnabled) {
      console.warn(
        `[RATE LIMIT] Redis indisponible — fallback mémoire pour: ${limitType}`,
      );
    } else {
      console.warn(
        `[RATE LIMIT] Limite Redis non initialisée: ${limitType} — fallback mémoire`,
      );
    }
    return applyMemoryFallback(`ip:${ip}`, limitType);
  }

  try {
    const { success, limit: max, reset, remaining } = await limit.limit(ip);

    if (!success) {
      return {
        allowed: false,
        response: buildRateLimitExceededResponse(max, remaining, reset),
      } as const;
    }

    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit": max.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": new Date(reset).toISOString(),
      },
    } as const;
  } catch (error) {
    console.error(
      `[RATE LIMIT] Erreur Redis (${limitType}), bascule mémoire:`,
      error,
    );
    return applyMemoryFallback(`ip:${ip}`, limitType);
  }
}

/**
 * Apply rate limiting by userId (in addition to IP)
 * This prevents a user with multiple IPs from bypassing limits
 */
export async function applyRateLimitByUser(
  request: Request,
  userId: string,
  limitType: keyof typeof rateLimits,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = rateLimits[limitType];

  // Apply BOTH IP-based and user-based limits
  // User gets blocked if EITHER limit is exceeded
  const userIdentifiers = [`ip:${ip}`, `user:${userId}`];

  // Fallback mémoire si Redis indisponible
  if (!ratelimitEnabled || !limit) {
    console.warn(
      `[RATE LIMIT] Redis indisponible — fallback mémoire (user) pour: ${limitType}`,
    );
    for (const identifier of userIdentifiers) {
      const result = applyMemoryFallback(identifier, limitType);
      if (!result.allowed) return result;
    }
    // Headers génériques quand tout passe en mémoire (on garde la forme existante)
    const config = memoryFallbackLimits[limitType];
    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit": String(config?.max ?? 100),
        "X-RateLimit-Remaining": String((config?.max ?? 100) - 1),
        "X-RateLimit-Reset": new Date(
          Date.now() + (config?.windowMs ?? 60000),
        ).toISOString(),
      },
    } as const;
  }

  try {
    for (const identifier of userIdentifiers) {
      const {
        success,
        limit: max,
        reset,
        remaining,
      } = await limit.limit(identifier);

      if (!success) {
        return {
          allowed: false,
          response: buildRateLimitExceededResponse(max, remaining, reset),
        } as const;
      }
    }
  } catch (error) {
    console.error(
      `[RATE LIMIT] Erreur Redis (${limitType}, user), bascule mémoire:`,
      error,
    );
    for (const identifier of userIdentifiers) {
      const result = applyMemoryFallback(identifier, limitType);
      if (!result.allowed) return result;
    }
  }

  return {
    allowed: true,
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
      "X-RateLimit-Reset": new Date(Date.now() + 60000).toISOString(),
    },
  } as const;
}
