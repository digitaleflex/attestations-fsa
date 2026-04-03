// app/api/user/verify-email/route.ts
// Vérification d'email via token
// Valide le token et marque l'email comme vérifié
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/error-handler'
import { sanitizeInput } from '@/lib/sanitization'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/verification-error?reason=missing-token', request.url)
      )
    }

    // Sanitization
    const sanitizedToken = sanitizeInput(token)

    // Trouver le token de vérification
    const verification = await prisma.verification.findFirst({
      where: {
        identifier: { startsWith: 'email_verify:' },
        value: sanitizedToken,
        expiresAt: { gt: new Date() },  // Token non expiré
      }
    })

    if (!verification) {
      return NextResponse.redirect(
        new URL('/verification-error?reason=invalid-token', request.url)
      )
    }

    // Extraire userId de l'identifier
    const userId = verification.identifier.split(':')[1]

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true }
    })
    
    if (!user) {
      return NextResponse.redirect(
        new URL('/verification-error?reason=user-not-found', request.url)
      )
    }

    // Vérifier si déjà vérifié
    if (user.emailVerified) {
      return NextResponse.redirect(
        new URL('/verification-error?reason=already-verified', request.url)
      )
    }

    // Marquer l'email comme vérifié
    await prisma.user.update({
      where: { id: userId },
      data: { 
        emailVerified: new Date(),
        updatedAt: new Date()
      }
    })

    // Supprimer le token (usage unique)
    await prisma.verification.delete({ 
      where: { id: verification.id } 
    })

    // Logger l'événement
    console.log(`[SECURITY] Email verified for user: ${user.email}`)

    // Rediriger vers page de succès
    return NextResponse.redirect(
      new URL('/verification-success', request.url)
    )

  } catch (error: any) {
    console.error('Verify email error:', error)
    return handleApiError(error, {
      route: '/api/user/verify-email',
      operation: 'verify_email',
    })
  }
}
