import { type NextRequest, NextResponse } from "next/server";

// Routes protégées
const ADMIN_ROUTES = ['/admin', '/api/admin'];
const USER_ROUTES = [
  '/dashboard',
  '/exams',
  '/attestations',
  '/results',
  '/profile',
  '/internships',
  '/courses',
  '/mock-exams',
  '/notifications',
  '/portfolio',
  '/support',
  '/transcript',
  '/api/user',
];

/**
 * Middleware d'authentification (Architecture Senior / Optimistic Auth)
 * 
 * Au lieu de faire un fetch HTTP ou d'appeler Prisma sur le Edge Runtime (anti-pattern sur Vercel),
 * ce middleware vérifie uniquement la PRÉSENCE du cookie.
 * S'il est absent -> Redirection immédiate (0ms).
 * S'il est présent -> On laisse passer. Le Server Component (Layout) validera réellement le rôle en base de données.
 */
export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Ignorer les routes internes et publiques
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/public') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
    const isUserRoute = USER_ROUTES.some(route => pathname.startsWith(route));

    // Création d'un header personnalisé pour passer le pathname aux Server Components
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-pathname', pathname);

    // Si c'est une route publique, on passe
    if (!isAdminRoute && !isUserRoute) {
        return NextResponse.next({
            request: { headers: requestHeaders }
        });
    }

    // 2. Vérification Optimiste (0ms latency, pas de DB)
    // On vérifie juste si le navigateur possède le cookie de session Better Auth
    const hasSessionCookie = 
        request.cookies.has("better-auth.session_token") || 
        request.cookies.has("__Secure-better-auth.session_token");

    // 3. Logique Admin
    if (isAdminRoute) {
        if (pathname === '/admin/login') {
            return NextResponse.next({ request: { headers: requestHeaders } });
        }

        if (!hasSessionCookie) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // 4. Logique Utilisateur
    if (isUserRoute) {
        if (!hasSessionCookie) {
            const loginUrl = new URL('/auth', request.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // On laisse passer vers le Layout/Page qui fera la validation DB sécurisée
    return NextResponse.next({
        request: { headers: requestHeaders }
    });
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
    ],
};
