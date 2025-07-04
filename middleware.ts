import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('authjs.session-token')?.value
  const isAuthPage = request.nextUrl.pathname.startsWith('/admin/login')
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  // Si l'utilisateur est sur une page d'administration sans session
  if (isAdminRoute && !isAuthPage && !session) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  // Si l'utilisateur est déjà connecté et tente d'accéder à la page de connexion
  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
