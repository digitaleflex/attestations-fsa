import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ message: 'Déconnexion réussie' })
  response.cookies.set('admin_session', '', {
    httpOnly: true,
    path: '/',
    expires: new Date(0),
  })
  return response
} 