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
    const code = searchParams.get('code')

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

    // ✅ RECHERCHE HYBRIDE: Correspondance exacte ou Suffixe (derniers caractères)
    // On privilégie l'exactitude
    let attestation = await prisma.attestation.findFirst({
      where: {
        OR: [
          { code: { equals: validCode, mode: 'insensitive' } }, // Correspondance exacte (priorité)
          { code: { endsWith: validCode, mode: 'insensitive' } } // Suffixe (ex: les 6 derniers caractères)
        ]
      },
      select: {
        id: true,
        code: true,
        fullName: true,
        type: true,
        status: true,
        certificationScore: true,
        stageScore: true,
        issuedAt: true,
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

    if (!attestation) {
      // Message générique pour ne pas révéler si le code existe
      return NextResponse.json({
        error: "Aucun certificat n'a été trouvé avec ce code. Veuillez vérifier la saisie."
      }, { status: 404 })
    }

    // Mapper certificationScore vers score pour la compatibilité frontend
    const responseData = {
      ...attestation,
      score: attestation.certificationScore || 0
    };

    return NextResponse.json({ attestation: responseData })

  } catch (error: unknown) {
    console.error('Erreur vérification attestation:', error);
    return handleApiError(error instanceof Error ? error : new Error(String(error)), {
      route: '/api/verifier',
      operation: 'verify_attestation',
    });
  }
}
