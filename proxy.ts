import { auth } from "./lib/auth";
import { type NextRequest, NextResponse } from "next/server";

// Routes protégées
const ADMIN_ROUTES = ['/admin', '/api/admin'];
const USER_ROUTES = ['/dashboard', '/exams', '/attestations', '/results', '/profile', '/internships', '/api/user'];

/**
 * Middleware d'authentification simplifié et standardisé
 * Suit strictement les recommandations de Better Auth
 */
export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Ignorer les fichiers statiques et les routes publiques standard
    if (
        pathname.startsWith('/_next') || 
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/public') ||
        pathname.includes('.') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    // 2. Récupérer la session via l'API officielle
    // Better Auth s'occupe de valider le token de session et le CSRF interne
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
    const isUserRoute = USER_ROUTES.some(route => pathname.startsWith(route));

    // 3. Logique de protection Admin
    if (isAdminRoute) {
        // Ignorer la page de login admin pour éviter les boucles
        if (pathname === '/admin/login') {
            if (session) return NextResponse.redirect(new URL('/admin/dashboard', request.url));
            return NextResponse.next();
        }

        if (!session) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }

        // Vérification stricte du rôle ADMIN
        if (session.user.role?.toLowerCase() !== 'admin') {
            return NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url));
        }
    }

    // 4. Logique de protection Utilisateur (Candidats)
    if (isUserRoute) {
        if (!session) {
            const loginUrl = new URL('/auth', request.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

/**
 * Matcher configuré pour exclure les ressources statiques
 */
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
    ],
};
