import { Ratelimit } from "@upstash/ratelimit";
import { getRedis, isRedisReady, reportRedisUnavailable } from "@/lib/redis";
import { NextResponse } from "next/server";
import type { Redis } from "@upstash/redis";

// Cast vers le type Upstash Redis : notre interface RedisClient est compatible
// en runtime, mais les génériques de @upstash/ratelimit exigent le type natif.
const redis = getRedis() as unknown as Redis | null;
const ratelimitEnabled = isRedisReady();

// ============================================================================
// #287 — Identité client fiable (IP + seau utilisateur)
// ============================================================================
// Ce bloc est volontairement autonome : `lib/rate-limit` est importé par le
// proxy (`proxy.ts`), qui ne doit pas embarquer `lib/auth` (Prisma/Better Auth).
//
// Le rate limiting est aussi solide que l'identité qu'il compte. Prendre
// `x-forwarded-for` tel quel revient à accepter un compteur neuf à chaque
// requête : il suffit d'ajouter une IP inventée dans l'en-tête.
//
// On ne retient donc que la partie de la chaîne écrite par un PROXY DE
// CONFIANCE, lue depuis la DROITE (convention usuelle des proxies) :
//   TRUSTED_PROXY_HOPS=1 (défaut) -> un saut de confiance (edge Vercel/CDN)
//   TRUSTED_PROXY_HOPS=0         -> XFF est totalement ignoré
// Ce qui est À GAUCHE du saut de confiance est piloté par le client final et
// n'entre jamais dans la clé de comptage.

/** Nombre de proxies de confiance par défaut (edge devant l'application). */
const DEFAULT_TRUSTED_PROXY_HOPS = 1;
const MAX_TRUSTED_PROXY_HOPS = 10;

/** Forme volontairement stricte : ni espaces, ni gadgets de clé Redis. */
const SAFE_IDENTITY = /^[A-Za-z0-9._:[\]-]{1,64}$/;

export function getTrustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw === undefined) return DEFAULT_TRUSTED_PROXY_HOPS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_TRUSTED_PROXY_HOPS;
  return Math.min(parsed, MAX_TRUSTED_PROXY_HOPS);
}

export type ClientIdentity = {
  /** Identité retenue pour le comptage (jamais un en-tête client non vérifié). */
  ip: string;
  /** `false` = identité non vérifiable : tous les clients partagent le seau. */
  trusted: boolean;
  source: "xff-trusted" | "cf-edge" | "unknown";
};

export function getClientIdentity(request: Request): ClientIdentity {
  const hops = getTrustedProxyHops();

  if (hops > 0) {
    const chain = (request.headers.get("x-forwarded-for") ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (chain.length > 0) {
      // Index depuis la droite : le saut de confiance le plus proche de l'app.
      const candidate = chain[Math.max(0, chain.length - hops)];
      if (candidate && SAFE_IDENTITY.test(candidate)) {
        return { ip: candidate, trusted: true, source: "xff-trusted" };
      }
    }
  }

  // Repli : en-tête réécrit par l'edge (Cloudflare le réinjecte et retire la
  // valeur fournie par le client). `x-real-ip` n'est PAS utilisé : rien ne
  // garantit qu'un proxy l'ait écrasé.
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp && SAFE_IDENTITY.test(cfIp)) {
    return { ip: cfIp, trusted: true, source: "cf-edge" };
  }

  return { ip: "unknown", trusted: false, source: "unknown" };
}

/** Raccourci : IP retenue pour le rate limiting. */
export function getClientIp(request: Request): string {
  return getClientIdentity(request).ip;
}

/** Hachage FNV-1a 32 bits : clé de seau opaque, jamais un secret réutilisable. */
export function hashIdentifier(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Valeur du cookie de session, quel que soit son préfixe (`__Secure-`). */
function readSessionCookieValue(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (
      name !== "better-auth.session_token" &&
      name !== "__Secure-better-auth.session_token"
    ) {
      continue;
    }
    const value = rest.join("=").trim();
    if (value) return value;
  }
  return null;
}

/**
 * Seau « utilisateur » pour le proxy, où aucune lecture DB n'est possible : on
 * se base sur la VALEUR du cookie de session, hachée. Un cookie n'est pas
 * devinable -> le seau ne se forge pas sans une session réelle. Sans cookie
 * (tentative de connexion/inscription) : seau anonyme commun.
 */
export function getSessionBucket(request: Request): string {
  const value = readSessionCookieValue(request.headers.get("cookie"));
  return value ? `sess:${hashIdentifier(value)}` : "sess:anonymous";
}

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

  // #315 — Statistiques publiques (GET /api/public/stats).
  //
  // Seau DÉDIÉ, et non le seau générique `api` : sous un même NAT (campus,
  // entreprise), l'IP d'un administrateur — derrière une authentification — et
  // celle d'un robot partagent aujourd'hui le même budget de 100 req/min, alors
  // que la seconde moitié n'est authentifiée par rien du tout. Séparer les deux
  // compteurs empêche qu'un crawl prive l'administrateur de son budget, et
  // réciproquement. C'est le seul objet de ce seau : le GÉNÉRIQUE `api` reste
  // intact pour les autres routes.
  //
  // Budget volontairement large (10 req/s par IP) : la route est PUBLIQUE,
  // servie par le cache de l'edge (`s-maxage=3600`) et ne fait que deux COUNT.
  // Sur un déploiement auto-hébergé, sans CDN, chaque affichage de page atteint
  // l'origine — et tout un campus, toute une entreprise se partagent une SEULE
  // IP publique. Un quota serré n'y bloquerait pas un robot mais des visiteurs
  // légitimes : ce serait une panne, pas une protection. Ce que le quota borne
  // réellement, c'est une amplification déjà triviale (deux COUNT d'index par
  // seconde et par IP) au lieu d'un `for i in seq 1 10000` sans fin.
  publicStats: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(600, "1 m"), // 600 req / minute
        analytics: true,
        prefix: "ratelimit:public-stats",
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

  // #287 — Points d'entrée d'authentification génériques (Better Auth :
  // sign-in/email, sign-up/email, request-password-reset…). Le middleware les
  // limite en DOUBLE comptage IP + seau de session.
  authEndpoint: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "5 m"), // 20 appels / 5min
        analytics: true,
        prefix: "ratelimit:auth-endpoint",
      })
    : null,

  // #287 — Upload de fichiers : nombre d'envois par heure.
  upload: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 h"), // 30 fichiers / heure
        analytics: true,
        prefix: "ratelimit:upload",
      })
    : null,

  // #287 — Upload de fichiers : quota de DÉBIT par heure (protège le bucket
  // d'un envoi massif de petits fichiers). Compté via INCRBY Redis, pas via
  // `Ratelimit` (qui ne manipule que des compteurs d'appels).
  uploadBytes: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, "1 h"),
        analytics: true,
        prefix: "ratelimit:bytes:uploadBytes",
      })
    : null,

  // #310 — Claim d'attestation (passage VALIDATED -> CLAIMED). Idempotent côté
  // métier mais limité pour contenir les boucles d'appel.
  attestationClaim: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 h"), // 20 claims / heure
        analytics: true,
        prefix: "ratelimit:attestation-claim",
      })
    : null,

  // #303 — Réclamation d'attestation par code (POST /api/user/claim-code).
  // Deviner un code revient à deviner ses 5 caractères hexadécimaux de fin
  // (20 bits, 1 048 576 combinaisons) : c'est une devinette de secret, donc
  // même fenêtre que `login` / `fsaOtpVerify` (15 min) et budget doublé,
  // l'entrée légitime étant un code de 25 caractères saisi à la main.
  claimCode: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "15 m"), // 10 tentatives / 15 min
        analytics: true,
        prefix: "ratelimit:claim-code",
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
  publicStats: { max: 600, windowMs: 1 * MINUTE },
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
  authEndpoint: { max: 20, windowMs: 5 * MINUTE },
  upload: { max: 30, windowMs: 60 * MINUTE },
  // 100 Mo / heure et par identité (le quota de débit, pas le nombre d'appels).
  uploadBytes: { max: 100 * 1024 * 1024, windowMs: 60 * MINUTE },
  attestationClaim: { max: 20, windowMs: 60 * MINUTE },
  claimCode: { max: 10, windowMs: 15 * MINUTE },
  adminBulk: { max: 10, windowMs: 5 * MINUTE },
  adminNotifications: { max: 5, windowMs: 10 * MINUTE },
  adminSettings: { max: 20, windowMs: 60 * MINUTE },
  adminLogin: { max: 5, windowMs: 15 * MINUTE },
};

// ============================================================================
// #310 — Endpoints sensibles : FAIL-CLOSED
// ============================================================================
// Le fallback mémoire est un compteur PAR INSTANCE Node : il n'est ni partagé
// entre les réplicas, ni durable. S'en servir comme filet sur un endpoint
// sensible revient à laisser passer le trafic en cas de panne Redis (fail-open)
// — précisément la fenêtre pendant laquelle une attaque passe.
//
// Ces endpoints REFUSENT donc (503) quand le compteur distribué est indisponible.
// La sortie de secours est explicite et documentée :
//   RATE_LIMIT_FAIL_OPEN=true  → comportement historique (dev local)
//   NODE_ENV=test              → les tests unitaires gardent le filet mémoire
const FAIL_CLOSED_LIMIT_TYPES = new Set<string>([
  // Authentification
  "login",
  "register",
  "adminLogin",
  "passwordReset",
  "fsaOtpRequest",
  "fsaOtpVerify",
  "emailVerification",
  "authEndpoint",
  // Upload
  "upload",
  "uploadBytes",
  // Mutation sensible
  "attestationClaim",
  // Devinette de secret (code de réclamation) : jamais fail-open.
  "claimCode",
  // `publicStats` en est DÉLIBÉRÉMENT absent. Le critère d'entrée dans la
  // liste est : « l'indisponibilité du compteur listenerait-elle un endpoint
  // qu'on ne peut pas laisser passer ? »
  //
  //  - ce que contient la liste : authentification, upload, mutation sensible,
  //    devinette de secret. Sur tous, un fail-open reviendrait à laisser
  //    passer l'attaque pendant la panne — exactement la fenêtre à protéger.
  //  - `publicStats` : lecture seule, anonyme, mise en cache, aucun secret et
  //    aucune mutation à protéger. Son indisponibilité n'abat qu'un compteur de
  //    transparence — et un 503 le temps d'une panne Upstash mettrait cet
  //    indicateur hors ligne pour TOUT le monde, robots compris. L'indicateur
  //    de transparence DOIT survivre à la panne de son propre garde.
  //
  // Ce n'est pas une absence de limite : le filet mémoire prend le relais
  // (compteur réel, mais par instance Node, cf. l'avertissement ci-dessus) —
  // le même compromis que le seau générique `api`, dont cette route a été
  // détachée. C'est de la dégradation assumée, pas un contournement.
]);

export function isFailClosedLimitType(limitType: string): boolean {
  return FAIL_CLOSED_LIMIT_TYPES.has(limitType);
}

/** Le filet mémoire est-il autorisé sur un endpoint sensible ? (opt-in explicite) */
function isFailOpenAllowed(): boolean {
  const optOut = process.env.RATE_LIMIT_FAIL_OPEN?.trim().toLowerCase();
  if (optOut === "true" || optOut === "1" || optOut === "yes") return true;
  // L'environnement de test n'est jamais exposé : on y conserve le filet
  // mémoire pour ne pas exiger Redis à la suite unitaire.
  return process.env.NODE_ENV === "test";
}

function buildRateLimitUnavailableResponse(scope: string) {
  return NextResponse.json(
    {
      error:
        "Service temporairement indisponible (protection anti-abus). Veuillez réessayer dans un instant.",
      code: "RATE_LIMIT_UNAVAILABLE",
      scope,
    },
    {
      status: 503,
      headers: { "Retry-After": "30" },
    },
  );
}

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
  getByteMemoryStore().clear();
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

// ============================================================================
// #310 — Quota de DÉBIT (upload) : store mémoire de repli
// ============================================================================
// Même mécanique que le compteur d'appels, mais on additionne des OCTETS plutôt
// que de compter des requêtes : un attaquant qui envoie 200 fichiers de 5 Mo
// reste sous un quota de « 200 requêtes ».

type GlobalWithByteLimitStore = typeof globalThis & {
  __inMemoryByteLimitStore?: Map<string, { at: number; bytes: number }[]>;
};

function getByteMemoryStore(): Map<string, { at: number; bytes: number }[]> {
  const g = globalThis as GlobalWithByteLimitStore;
  if (!g.__inMemoryByteLimitStore) {
    g.__inMemoryByteLimitStore = new Map();
  }
  return g.__inMemoryByteLimitStore;
}

/** Consomme `bytes` sur un budget de `maxBytes` octets par fenêtre glissante. */
export function checkInMemoryByteLimit(
  key: string,
  maxBytes: number,
  windowMs: number,
  bytes: number,
  now = Date.now(),
): { success: boolean; remaining: number; reset: number; limit: number } {
  const store = getByteMemoryStore();
  const entries = (store.get(key) ?? []).filter((e) => e.at > now - windowMs);
  const used = entries.reduce((sum, e) => sum + e.bytes, 0);
  const oldest = entries[0]?.at ?? now;

  if (used + bytes > maxBytes) {
    return { success: false, remaining: 0, reset: oldest + windowMs, limit: maxBytes };
  }

  entries.push({ at: now, bytes });
  store.set(key, entries);
  return {
    success: true,
    remaining: maxBytes - (used + bytes),
    reset: now + windowMs,
    limit: maxBytes,
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

/**
 * Résultat interne commun aux compteurs mémoire.
 * `allowed: false` porte soit un 429 (quota atteint), soit un 503
 * (compteur distribué indisponible sur un endpoint sensible).
 */
type RateLimitDecision =
  | { allowed: true; headers: Record<string, string> }
  | { allowed: false; response: NextResponse };

/**
 * #310 — Décision quand Redis est indisponible / la limite n'est pas
 * initialisée : filet mémoire pour les endpoints tolérants, REFUS (503) pour
 * les endpoints sensibles.
 */
function resolveRedisUnavailable(
  limitType: keyof typeof rateLimits,
  identifiers: string[],
  reason: string,
  error?: unknown,
  /** Filet mémoire : compteur d'appels par défaut, compteur d'octets pour un quota de débit. */
  fallback: (identifier: string) => RateLimitDecision = (identifier) =>
    applyMemoryFallback(identifier, limitType),
): RateLimitDecision {
  if (!isFailClosedLimitType(limitType) || isFailOpenAllowed()) {
    if (error) {
      console.error(`[RATE LIMIT] Erreur Redis (${limitType}), bascule mémoire:`, error);
    } else {
      console.warn(`[RATE LIMIT] Redis indisponible — fallback mémoire pour: ${limitType}`);
    }
    for (const identifier of identifiers) {
      const result = fallback(identifier);
      if (!result.allowed) return result;
    }
    const config = memoryFallbackLimits[limitType];
    const max = config?.max ?? 100;
    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit": String(max),
        "X-RateLimit-Remaining": String(Math.max(0, max - 1)),
        "X-RateLimit-Reset": new Date(
          Date.now() + (config?.windowMs ?? MINUTE),
        ).toISOString(),
      },
    };
  }

  // Endpoint sensible : on refuse, et on alerte (log JSON + Sentry, throttlé).
  reportRedisUnavailable(`${limitType}:${reason}`, error);
  console.error(
    `[RATE LIMIT] Fail-closed (${limitType}, ${reason}) — requête refusée, Redis indisponible`,
  );
  return { allowed: false, response: buildRateLimitUnavailableResponse(limitType) };
}

// ✅ FIX: Accept Request instead of NextRequest
export async function applyRateLimit(
  request: Request,
  limitType: keyof typeof rateLimits,
): Promise<RateLimitDecision> {
  // #287 — identité via le proxy de confiance, jamais `x-forwarded-for` brut.
  const ip = getClientIp(request);
  const limit = rateLimits[limitType];

  if (!ratelimitEnabled || !limit) {
    return resolveRedisUnavailable(limitType, [`ip:${ip}`], "non-configure");
  }

  try {
    const { success, limit: max, reset, remaining } = await limit.limit(`ip:${ip}`);

    if (!success) {
      return {
        allowed: false,
        response: buildRateLimitExceededResponse(max, remaining, reset),
      };
    }

    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit": max.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": new Date(reset).toISOString(),
      },
    };
  } catch (error) {
    return resolveRedisUnavailable(limitType, [`ip:${ip}`], "erreur", error);
  }
}

/**
 * Double comptage IP + utilisateur : l'utilisateur est bloqué si l'UN OU
 * L'AUTRE des deux compteurs dépasse son budget. Empêche de contourner la
 * limite en changeant d'adresse IP (ou de proxy).
 */
export async function applyRateLimitByUser(
  request: Request,
  userId: string,
  limitType: keyof typeof rateLimits,
): Promise<RateLimitDecision> {
  const ip = getClientIp(request);
  const limit = rateLimits[limitType];
  const userIdentifiers = [`ip:${ip}`, `user:${userId}`];

  if (!ratelimitEnabled || !limit) {
    return resolveRedisUnavailable(limitType, userIdentifiers, "non-configure");
  }

  try {
    let last = { limit: 0, reset: Date.now() + MINUTE, remaining: 0 };
    for (const identifier of userIdentifiers) {
      const result = await limit.limit(identifier);
      last = result;
      if (!result.success) {
        return {
          allowed: false,
          response: buildRateLimitExceededResponse(
            result.limit,
            result.remaining,
            result.reset,
          ),
        };
      }
    }
    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit": String(last.limit),
        "X-RateLimit-Remaining": String(last.remaining),
        "X-RateLimit-Reset": new Date(last.reset).toISOString(),
      },
    };
  } catch (error) {
    return resolveRedisUnavailable(limitType, userIdentifiers, "erreur", error);
  }
}

// ============================================================================
// #310 — Quota de DÉBIT distribué (octets, pas appels)
// ============================================================================

/** Consommation d'octets via Redis : `INCRBY` + `EXPIRE` sur la fenêtre. */
async function consumeRedisBytes(
  key: string,
  bytes: number,
  windowMs: number,
): Promise<{ used: number; ttlSeconds: number }> {
  const client = getRedis();
  if (!client) throw new Error("Redis non configuré");
  const used = await client.incrby(key, bytes);
  // `used === bytes` => première écriture de la fenêtre : on arme l'expiration.
  let ttlSeconds = await client.ttl(key);
  if (used === bytes || !Number.isFinite(ttlSeconds) || ttlSeconds < 0) {
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    await client.expire(key, windowSeconds);
    ttlSeconds = windowSeconds;
  }
  return { used, ttlSeconds };
}

function applyMemoryByteFallback(
  identifier: string,
  limitType: keyof typeof rateLimits,
  bytes: number,
): RateLimitDecision {
  const config = memoryFallbackLimits[limitType];
  if (!config) {
    console.warn(`[RATE LIMIT] Type de limit inconnu: ${limitType}`);
    return { allowed: true, headers: {} };
  }
  const { success, remaining, reset, limit: max } = checkInMemoryByteLimit(
    `memory-bytes:${limitType}:${identifier}`,
    config.max,
    config.windowMs,
    bytes,
  );
  if (!success) {
    return {
      allowed: false,
      response: buildRateLimitExceededResponse(max, remaining, reset),
    };
  }
  return {
    allowed: true,
    headers: {
      "X-RateLimit-Limit": String(max),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": new Date(reset).toISOString(),
    },
  };
}

/**
 * Quota de débit en double comptage IP + utilisateur.
 * `uploadBytes` est fail-closed : sans compteur distribué, on refuse l'upload.
 */
export async function applyByteQuotaByUser(
  request: Request,
  userId: string,
  bytes: number,
  limitType: "uploadBytes",
): Promise<RateLimitDecision> {
  const ip = getClientIp(request);
  const config = memoryFallbackLimits[limitType];
  const windowMs = config?.windowMs ?? 60 * MINUTE;
  const identifiers = [`ip:${ip}`, `user:${userId}`];

  // Le filet mémoire d'un quota de DÉBIT doit compter des OCTETS, pas des appels.
  const byteFallback = (identifier: string) =>
    applyMemoryByteFallback(identifier, limitType, bytes);

  if (!ratelimitEnabled || !getRedis()) {
    return resolveRedisUnavailable(
      limitType,
      identifiers,
      "non-configure",
      undefined,
      byteFallback,
    );
  }

  try {
    for (const identifier of identifiers) {
      const key = `ratelimit:bytes:${limitType}:${identifier}`;
      const { used, ttlSeconds } = await consumeRedisBytes(key, bytes, windowMs);
      const max = config?.max ?? Number.MAX_SAFE_INTEGER;
      if (used > max) {
        return {
          allowed: false,
          response: buildRateLimitExceededResponse(
            max,
            0,
            Date.now() + ttlSeconds * 1000,
          ),
        };
      }
    }
    return { allowed: true, headers: {} };
  } catch (error) {
    return resolveRedisUnavailable(
      limitType,
      identifiers,
      "erreur",
      error,
      byteFallback,
    );
  }
}
