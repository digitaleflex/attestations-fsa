import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const response = NextResponse.json({ message: 'Déconnexion réussie' })
    response.cookies.set('admin_session', '', {
      httpOnly: true,
      path: '/',
      expires: new Date(0),
    })
    response.cookies.set('user_role', '', {
      path: '/',
      expires: new Date(0),
    })
    return response
  } catch (error) {
    console.error('[POST /api/auth/logout ERROR]', error)
    return NextResponse.json(
      { error: 'Erreur lors de la déconnexion' },
      { status: 500 }
    )
  }
}
