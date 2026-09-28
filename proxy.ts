import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
// `lib/rate-limit` est volontairement autonome (ni Prisma, ni Better Auth) :
// il est chargé par le proxy. L'identité client vient de là, pas de
// `lib/api-auth` (qui tirerait `lib/auth` dans le bundle du proxy).
import { applyRateLimitByUser, getSessionBucket } from "@/lib/rate-limit";

// #287 — Rate limit des endpoints d'authentification.
/**
 * `/api/auth/*` (Better Auth : sign-in, sign-up, request-password-reset…) est
 * exclu de tout pré-filtre de session : rien n'y était limité, et
 * `lib/auth.ts` n'est volontairement pas touché. La protection est donc posée
 * ici, en amont du gestionnaire : double comptage IP (via le proxy de
 * confiance) + seau de session (haché, non forgeable).
 *
 * `/api/auth/fsa-login` est laissé de côté : la route applique déjà son propre
 * quota (par IP, et par IP+code sur la vérification d'OTP).
 */
const AUTH_RATE_LIMIT_PREFIX = "/api/auth";
const AUTH_RATE_LIMIT_EXCLUDED = ["/api/auth/fsa-login", "/api/auth/logout"];

function isAuthRateLimited(pathname: string): boolean {
  if (!pathname.startsWith(AUTH_RATE_LIMIT_PREFIX)) return false;
  return !AUTH_RATE_LIMIT_EXCLUDED.some((prefix) => pathname.startsWith(prefix));
}

// Routes protégées
const ADMIN_ROUTES = ["/admin", "/api/admin"];
const USER_ROUTES = [
  "/dashboard",
  "/exams",
  "/attestations",
  "/results",
  "/profile",
  "/internships",
  "/notifications",
  "/transcript",
  "/api/user",
];

/**
 * Middleware d'authentification (Architecture Senior / Optimistic Auth + garde-fous)
 *
 * Le middleware Edge ne peut pas interroger la DB (Prisma incompatible Edge sur Vercel),
 * donc il fait un pré-filtre rapide SANS DB :
 *  1. Présence du cookie de session Better Auth
 *  2. Plausibilité de sa VALEUR (non vide, longueur minimale, pas de placeholder)
 * S'il est absent ou manifestement invalide -> 401 JSON pour /api/*, redirection sinon.
 * S'il semble valide -> on laisse passer. Le Layout serveur / la route API
 * (via `@/lib/api-auth` -> `getAdminUser` / `getCurrentUser`) validera RÉELLEMENT
 * la session et le rôle en base de données.
 */

function getSessionCookieValue(request: NextRequest): string | null {
  const cookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");
  return cookie?.value ?? null;
}

/**
 * Vérifie que la valeur du cookie ressemble à un vrai token de session.
 * Ne remplace PAS la validation DB, mais bloque les cookies vides/forgés
 * sans coût (0ms, pas de DB).
 */
export function isPlausibleSessionToken(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 10) return false;
  if (trimmed === "null" || trimmed === "undefined") return false;
  return true;
}

function unauthorizedApiResponse() {
  return NextResponse.json(
    { message: "Non autorisé", code: "UNAUTHORIZED" },
    { status: 401 },
  );
}
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // #290 — Nonce CSP unique par requête.
  // Généré ici et passé en header pour que les Server Components puissent
  // l'injecter dans les balises <script> et <style> inline.
  const nonce = randomUUID().replace(/-/g, "");
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.resend.com https://*.upstash.io wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  // 0. Rate limit des endpoints d'authentification (#287).
  // Bloc autonome et strictement local : il ne touche ni à la classification
  // des routes, ni à la logique de session/compte qui suit.
  if (isAuthRateLimited(pathname)) {
    const rateLimit = await applyRateLimitByUser(
      request,
      getSessionBucket(request),
      "authEndpoint",
    );
    if (!rateLimit.allowed) return rateLimit.response;
  }

  // 1. Ignorer les routes internes et publiques (pas de CSP renforcé)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));
  const isUserRoute = USER_ROUTES.some((route) => pathname.startsWith(route));

  // Création d'un header personnalisé pour passer le pathname aux Server Components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-nonce", nonce);

  /** Ajoute le CSP + nonce à toute réponse sortante. */
  function withCsp(response: NextResponse): NextResponse {
    response.headers.set("Content-Security-Policy", cspHeader);
    return response;
  }

  // Si c'est une route publique, on passe avec CSP
  if (!isAdminRoute && !isUserRoute) {
    return withCsp(NextResponse.next({
      request: { headers: requestHeaders },
    }));
  }

  // 2. Vérification optimiste renforcée (0ms latency, pas de DB)
  // On vérifie la PRÉSENCE ET la plausibilité de la valeur du cookie.
  // Un cookie présent mais vide/trop court est traité comme absent.
  const sessionCookieValue = getSessionCookieValue(request);
  const hasSessionCookie = isPlausibleSessionToken(sessionCookieValue);

  const isApiRoute = pathname.startsWith("/api/");

  // 3. Logique Admin
  if (isAdminRoute) {
    if (
      pathname === "/admin/login" ||
      pathname === "/admin/register" ||
      pathname === "/admin/signup"
    ) {
      return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
    }

    if (!hasSessionCookie) {
      if (isApiRoute) return unauthorizedApiResponse();
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return withCsp(NextResponse.redirect(loginUrl));
    }
  }

  // 4. Logique Utilisateur
  if (isUserRoute) {
    if (!hasSessionCookie) {
      if (isApiRoute) return unauthorizedApiResponse();
      const loginUrl = new URL("/auth", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return withCsp(NextResponse.redirect(loginUrl));
    }
  }

  // On laisse passer vers le Layout/Page qui fera la validation DB sécurisée
  return withCsp(NextResponse.next({
    request: { headers: requestHeaders },
  }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
