// middleware.ts
// Middleware de sécurité Next.js - Protection CSRF, Headers de sécurité, Rate limiting
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes protégées par rôle
const ADMIN_ROUTES = ['/admin', '/api/admin']
const USER_ROUTES = ['/dashboard', '/exams', '/attestations', '/results', '/profile', '/internships', '/api/user']
const PUBLIC_ROUTES = ['/api/public', '/api/verifier', '/api/signalement', '/api/waitlist', '/auth']
const AUTH_ROUTES = ['/admin/login', '/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip session check for static files and standard Next.js paths
  if (pathname.includes('.') || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  // ============================================
  // 1. HEADERS DE SÉCURITÉ (US-SEC-03)
  // ============================================
  
  // Empêche le clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Empêche le MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Protection XSS (navigateurs anciens)
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Contrôle les informations de référence
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Désactive les fonctionnalités dangereuses
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )
  
  // HSTS uniquement en production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Content Security Policy - Restrictif mais fonctionnel
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://upstash.io https://api.resend.com https://vercel.live",
      "frame-src 'self' https://vercel.live",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  )

  // ============================================
  // 2. PROTECTION CSRF (US-SEC-01)
  // ============================================
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
    const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route))

    // Skip CSRF for public webhooks and verification endpoints
    if (!isPublicRoute && !isAuthRoute) {
      const csrfToken = request.cookies.get('csrf_token')?.value
      const headerToken = request.headers.get('x-csrf-token')

      if (!csrfToken) {
        // No token yet - generate one
        const newToken = generateCSRFToken()
        response.cookies.set('csrf_token', newToken, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 60 * 60 * 24,
        })
      } else if (!headerToken || csrfToken !== headerToken) {
        return new NextResponse(
          JSON.stringify({ error: 'Token CSRF invalide ou manquant', code: 'CSRF_INVALID' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  }

  // ============================================
  // 3. VÉRIFICATION AUTHENTIFICATION ROBUSTE
  // ============================================
  const sessionToken = request.cookies.get('better-auth.session_token')?.value
  const sessionDataCookie = request.cookies.get('better-auth.session_data')?.value
  const legacyRole = request.cookies.get('user_role')?.value
  const legacySession = request.cookies.get('admin_session')?.value
  
  // Routes admin
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    // Page de login admin (ignorer si déjà en cours de login)
    if (pathname === '/admin/login') {
      if (sessionToken || legacySession) {
        // Déjà authentifié ? Redirect vers le dashboard
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      return response
    }
    
    // Pas de session du tout ?
    if (!sessionToken && !legacySession) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Session expirée - Reconnectez-vous', code: 'AUTH_REQUIRED' },
          { status: 401 }
        )
      }
      // Redirection sécurisée vers la page de login
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    // Vérifier le rôle ADMIN (Méthode souple : Better Auth data OU legacy user_role)
    let isAdmin = false;
    
    // 1. Essai avec Better Auth session data
    try {
      if (sessionDataCookie) {
        const sessionData = JSON.parse(decodeURIComponent(sessionDataCookie))
        isAdmin = sessionData.user?.role === 'ADMIN' || sessionData.role === 'ADMIN';
      } else {
        // Fallback: Si le cookie session_data manque mais qu'on a un token, on peut laisser passer
        // vers la page car le client Better Auth rafraîchira les données, 
        // évitant ainsi les boucles de redirection immédiates.
        if (sessionToken) isAdmin = true; 
      }
    } catch (e) { /* ignore parse error */ }
    
    // 2. Fallback avec user_role direct (utilisé dans le login legacy)
    if (!isAdmin && legacyRole === 'ADMIN') {
      isAdmin = true;
    }
    
    if (!isAdmin) {
      // Pas de droits admin ? On rejette
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Accès restreint - Administrateurs uniquement', code: 'ADMIN_REQUIRED' },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Routes utilisateur (candidats)
  if (USER_ROUTES.some(route => pathname.startsWith(route))) {
    if (!sessionToken && !legacySession) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentification requise', code: 'AUTH_REQUIRED' },
          { status: 401 }
        )
      }
      return NextResponse.redirect(new URL('/auth', request.url))
    }
  }

  // ============================================
  // 4. RATE LIMITING HEADERS (US-SEC-02)
  // ============================================
  // Les headers sont ajoutés pour information
  // Le vrai rate limiting est géré dans les routes API
  response.headers.set('X-RateLimit-Limit', '100')
  response.headers.set('X-RateLimit-Remaining', '99')

  return response
}

// Générer un token CSRF cryptographiquement sûr compatible avec Edge Runtime
function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (robots.txt, sitemap.xml, etc.)
     * - fichiers statiques
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
