import { Ratelimit } from "@upstash/ratelimit"
import { getRedis, isRedisReady } from "@/lib/redis"
import { NextResponse } from 'next/server'

const redis = getRedis()
const ratelimitEnabled = isRedisReady()

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

  // Internship applications
  internship: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),  // 3 candidatures / heure
    analytics: true,
    prefix: "ratelimit:internship",
  }) : null,

  // Contact form
  contact: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),  // 5 messages / heure
    analytics: true,
    prefix: "ratelimit:contact",
  }) : null,

  // FSA login — OTP request (3 demandes / 10min par IP)
  fsaOtpRequest: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "10 m"),
    analytics: true,
    prefix: "ratelimit:fsa-otp-request",
  }) : null,

  // FSA login — OTP verify (5 essais / 15min par IP+code)
  fsaOtpVerify: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    analytics: true,
    prefix: "ratelimit:fsa-otp-verify",
  }) : null,

  // ==========================================
  // ADMIN RATE LIMITS - Sécurité renforcée
  // ==========================================

  // Admin bulk operations (attestations, users, etc.)
  adminBulk: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "5 m"),  // 10 opérations / 5min
    analytics: true,
    prefix: "ratelimit:admin-bulk",
  }) : null,

  // Admin bulk notifications
  adminNotifications: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),  // 5 envois / 10min
    analytics: true,
    prefix: "ratelimit:admin-notifications",
  }) : null,

  // Admin settings changes
  adminSettings: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),  // 20 modifications / heure
    analytics: true,
    prefix: "ratelimit:admin-settings",
  }) : null,

  // Admin login (spécifique, plus restrictif que login user)
  adminLogin: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),  // 5 essais / 15min
    analytics: true,
    prefix: "ratelimit:admin-login",
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

/**
 * Apply rate limiting by userId (in addition to IP)
 * This prevents a user with multiple IPs from bypassing limits
 */
export async function applyRateLimitByUser(
  request: Request,
  userId: string,
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

  // Apply BOTH IP-based and user-based limits
  // User gets blocked if EITHER limit is exceeded
  const userIdentifiers = [
    `ip:${ip}`,
    `user:${userId}`,
  ]

  for (const identifier of userIdentifiers) {
    const { success, limit: max, reset, remaining } = await limit.limit(identifier)

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
  }

  return {
    allowed: true,
    headers: {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
      'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
    },
  } as const
}
