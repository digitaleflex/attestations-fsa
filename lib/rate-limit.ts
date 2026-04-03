// lib/rate-limit.ts
// Rate limiting avec Upstash Redis - Protection contre brute-force et DDoS
// ✅ FIX: Accept Request instead of NextRequest to eliminate `as any` casts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from 'next/server'

// Initialisation Redis
// Note: Si Upstash n'est pas configuré, le rate limiting sera désactivé
let redis: Redis | null = null
let ratelimitEnabled = false

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    ratelimitEnabled = true
  } else {
    console.warn('[RATE LIMIT] Upstash Redis non configuré. Rate limiting désactivé.')
    console.warn('[RATE LIMIT] Ajoutez UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN dans .env')
  }
} catch (error: unknown) {
  console.error('[RATE LIMIT] Erreur lors de l\'initialisation de Redis:', error)
}

// Rate limits par endpoint
export const rateLimits = {
  // Authentification - Très restrictif
  login: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),  // 5 essais / 15min
    analytics: true,
    prefix: "ratelimit:login",
  }) : null,

  // Inscription
  register: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),  // 3 inscriptions / heure
    analytics: true,
    prefix: "ratelimit:register",
  }) : null,

  // Signalement
  report: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),  // 3 signalements / heure
    analytics: true,
    prefix: "ratelimit:report",
  }) : null,

  // Vérification code
  verify: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),  // 10 vérifications / heure
    analytics: true,
    prefix: "ratelimit:verify",
  }) : null,

  // API générale
  api: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),  // 100 req / minute
    analytics: true,
    prefix: "ratelimit:api",
  }) : null,

  // Soumission examen
  submission: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),  // 5 submissions / heure
    analytics: true,
    prefix: "ratelimit:submission",
  }) : null,

  // Password reset request
  passwordReset: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),  // 3 demandes / heure
    analytics: true,
    prefix: "ratelimit:password-reset",
  }) : null,

  // Envoi email de vérification
  emailVerification: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),  // 5 envois / heure
    analytics: true,
    prefix: "ratelimit:email-verify",
  }) : null,
}

// ✅ FIX: Accept Request instead of NextRequest
export async function applyRateLimit(
  request: Request,
  limitType: keyof typeof rateLimits
) {
  // Si Redis n'est pas configuré, on bypass le rate limiting
  if (!ratelimitEnabled) {
    return {
      allowed: true,
      headers: {} as Record<string, string>,
    } as const
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const limit = rateLimits[limitType]

  if (!limit) {
    console.warn(`[RATE LIMIT] Type de limit inconnu: ${limitType}`)
    return {
      allowed: true,
      headers: {} as Record<string, string>,
    } as const
  }

  const { success, limit: max, reset, remaining } = await limit.limit(ip)

  if (!success) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Trop de requêtes. Veuillez réessayer plus tard.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: new Date(reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': max.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': new Date(reset).toISOString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      ),
    } as const
  }

  return {
    allowed: true,
    headers: {
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    },
  } as const
}
