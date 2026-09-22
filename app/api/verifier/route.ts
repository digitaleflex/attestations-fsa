// app/api/verifier/route.ts
// Route de vérification d'attestation avec rate limiting
// Endpoint public - protection contre le scraping
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { applyRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/error-handler'
import { sanitizeInput } from '@/lib/sanitization'
import { verifyCertificateSeal } from '@/lib/crypto/seal'

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

    // ✅ RECHERCHE SÉCURISÉE : Correspondance exacte uniquement
    // On ne permet la vérification que pour les attestations VALIDÉES ou RÉCUPÉRÉES
    const attestation = await prisma.attestation.findFirst({
      where: {
        code: { equals: validCode, mode: 'insensitive' },
        status: { in: ['VALIDATED', 'CLAIMED'] }
      },
      select: {
        id: true,
        code: true,
        fullName: true,
        type: true,
        status: true,
        certificationScore: true,
        stageScore: true,
        certificationMention: true,
        sealHash: true,
        sealedAt: true,
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

    // Preuve de scellement (#155) : recalcul de l'empreinte depuis les données
    // en base et comparaison à l'empreinte stockée. Toute divergence = altération.
    const seal = verifyCertificateSeal({
      code: attestation.code,
      fullName: attestation.fullName,
      formationName: attestation.formation?.name ?? null,
      certificationScore: attestation.certificationScore,
      certificationMention: attestation.certificationMention,
      endDate: attestation.endDate,
      sealHash: attestation.sealHash,
    });

    // Mapper certificationScore vers score pour la compatibilité frontend
    const responseData = {
      ...attestation,
      score: attestation.certificationScore || 0,
      proof: {
        algorithm: seal.algorithm,
        sealed: seal.sealed,
        valid: seal.valid,
        reason: seal.reason ?? null,
        revoked: attestation.status === 'REJECTED',
        status: attestation.status,
        sealedAt: attestation.sealedAt,
        checkedAt: new Date().toISOString(),
      },
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
