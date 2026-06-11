import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    await auth.api.signOut({ headers: request.headers })
    return NextResponse.json({ message: 'Déconnexion réussie' })
  } catch (error) {
    console.error('[POST /api/auth/logout ERROR]', error)
    return NextResponse.json(
      { error: 'Erreur lors de la déconnexion' },
      { status: 500 }
    )
  }
}
