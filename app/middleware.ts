// middleware.ts
import { getAuth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Fonction pour obtenir le token de session depuis les cookies
function getSessionToken(req: NextRequest): string | undefined {
  // Vérifie d'abord le cookie de session standard
  const sessionToken = req.cookies.get('authjs.session-token')?.value
  if (sessionToken) return sessionToken
  
  // Vérifie également le préfixe __Secure- pour les cookies sécurisés
  return req.cookies.get('__Secure-authjs.session-token')?.value
}

export async function middleware(req: NextRequest) {
  // Pour les routes API, laissons-les gérer leur propre authentification
  if (req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Récupération du token de session
  const sessionToken = getSessionToken(req)
  
  // Pages accessibles sans authentification
  const publicPaths = ["/admin/login", "/admin/register", "/admin/error"]
  const isPublicPath = publicPaths.some(path => 
    req.nextUrl.pathname === path || 
    req.nextUrl.pathname.startsWith(`${path}/`)
  )
  
  // Redirection si déjà connecté et sur une page publique
  if (isPublicPath) {
    if (sessionToken) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // Protection des routes admin
  if (req.nextUrl.pathname.startsWith("/admin")) {
    if (!sessionToken) {
      const loginUrl = new URL("/admin/login", req.url)
      // Stocke l'URL demandée pour une redirection après connexion
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    // La présence du token est considérée comme suffisante pour le middleware
    // Une vérification plus poussée sera faite côté serveur
    const response = NextResponse.next()
    
    // Ajout d'un en-tête personnalisé pour indiquer que l'utilisateur est authentifié
    response.headers.set('x-auth-status', 'authenticated')
    
    return response
  }
  
  // Pour toutes les autres routes, on laisse passer la requête
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Toutes les routes admin sauf les fichiers statiques et l'API
    "/admin/:path*",
    // Les routes d'API qui nécessitent une authentification
    // "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
