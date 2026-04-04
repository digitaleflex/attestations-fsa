// app/api/verifier/route.ts
// Route de vérification d'attestation avec rate limiting
// Endpoint public - protection contre le scraping
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { applyRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/error-handler'
import { sanitizeInput } from '@/lib/sanitization'

export async function GET(request: Request) {
  try {
    // ✅ RATE LIMITING - 10 vérifications maximum par heure
    const rateLimit = await applyRateLimit(request, 'verify')
    if (!rateLimit.allowed && rateLimit.response) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      console.warn(`[SECURITY] Rate limit exceeded for verification from IP: ${ip}`)
      return rateLimit.response
    }

    const { searchParams } = new URL(request.url)
    let code = searchParams.get('code')
    
    // Validation stricte du paramètre code
    const CodeSchema = z.string().min(5, 'Code requis (minimum 5 caractères)').max(50)
    const parse = CodeSchema.safeParse(code)
    
    if (!parse.success) {
      return NextResponse.json({ 
        error: 'Le code est requis et doit contenir au moins 5 caractères.', 
        details: parse.error.errors 
      }, { status: 400 })
    }

    // Sanitization
    const validCode = sanitizeInput(parse.data.trim())

    let attestation

    // Si le code fait 5 caractères ou moins, chercher par suffixe
    // Sinon, chercher par correspondance exacte
    if (validCode.length <= 5) {
      attestation = await prisma.attestation.findFirst({
        where: { code: { endsWith: validCode } },
        select: {
          fullName: true,
          type: true,
          status: true,
          startDate: true,
          endDate: true,
          location: true,
          instructor: true,
          formation: {
            select: {
              name: true,
              category: true,
            }
          }
        }
      })
    } else {
      attestation = await prisma.attestation.findUnique({
        where: { code: validCode },
        select: {
          fullName: true,
          type: true,
          status: true,
          startDate: true,
          endDate: true,
          location: true,
          instructor: true,
          formation: {
            select: {
              name: true,
              category: true,
            }
          }
        }
      })
    }

    if (!attestation) {
      // Message générique pour ne pas révéler si le code existe
      return NextResponse.json({ 
        error: "Aucun certificat n'a été trouvé avec ce code. Veuillez vérifier la saisie." 
      }, { status: 404 })
    }

    return NextResponse.json({ attestation })
    
  } catch (error: any) {
    console.error('Erreur vérification attestation:', error)
    return handleApiError(error, {
      route: '/api/verifier',
      operation: 'verify_attestation',
    })
  }
}
