import { auth } from "./lib/auth";
import { type NextRequest, NextResponse } from "next/server";

// Routes protégées
const ADMIN_ROUTES = ['/admin', '/api/admin'];
const USER_ROUTES = ['/dashboard', '/exams', '/attestations', '/results', '/profile', '/internships', '/api/user'];

/**
 * Middleware de redirection proxy (alias de middleware.ts)
 */
export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (
        pathname.startsWith('/_next') || 
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/public') ||
        pathname.includes('.') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
    const isUserRoute = USER_ROUTES.some(route => pathname.startsWith(route));

    if (!isAdminRoute && !isUserRoute) {
        return NextResponse.next();
    }

    let session = null;
    try {
        session = await auth.api.getSession({
            headers: request.headers,
        });
    } catch (e) {
        console.error("⚠️ [PROXY AUTH ERROR] Impossible de contacter la DB pour la session:", e);
    }

    if (isAdminRoute) {
        if (pathname === '/admin/login') {
            if (session) return NextResponse.redirect(new URL('/admin/dashboard', request.url));
            return NextResponse.next();
        }

        if (!session) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }

        if (session.user.role?.toLowerCase() !== 'admin') {
            return NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url));
        }
    }

    if (isUserRoute) {
        if (!session) {
            const loginUrl = new URL('/auth', request.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
    ],
};
