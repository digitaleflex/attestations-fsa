import { type NextRequest, NextResponse } from "next/server";

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
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Ignorer les routes internes et publiques
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

  // Si c'est une route publique, on passe
  if (!isAdminRoute && !isUserRoute) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
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
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (!hasSessionCookie) {
      if (isApiRoute) return unauthorizedApiResponse();
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 4. Logique Utilisateur
  if (isUserRoute) {
    if (!hasSessionCookie) {
      if (isApiRoute) return unauthorizedApiResponse();
      const loginUrl = new URL("/auth", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // On laisse passer vers le Layout/Page qui fera la validation DB sécurisée
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
