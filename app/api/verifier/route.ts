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
import { attestationSealPayload } from '@/lib/attestations/proof'
import { officialPdfDownloadPath } from '@/lib/attestations/verification-url'

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
    // On expose la vérification pour les attestations VALIDÉES / RÉCUPÉRÉES,
    // et on charge aussi les attestations REJETÉES pour pouvoir signaler une
    // révocation explicite au lieu de la déclarer introuvable (#224).
    const attestation = await prisma.attestation.findFirst({
      where: {
        code: { equals: validCode, mode: 'insensitive' },
        status: { in: ['VALIDATED', 'CLAIMED', 'REJECTED'] }
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
        sealVersion: true,
        sessionId: true,
        userId: true,
        formationId: true,
        email: true,
        gender: true,
        birthDate: true,
        birthPlace: true,
        issuingCompany: true,
        certificationHours: true,
        certificationObservations: true,
        stageHours: true,
        stageObservations: true,
        pdfKey: true,
        pdfHash: true,
        pdfVersion: true,
        pdfGeneratedAt: true,
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
    const seal = verifyCertificateSeal(attestationSealPayload(attestation));

    // Révocation (#224) : le code existe mais l'attestation a été rejetée.
    // On le déclare explicitement — un vérificateur public doit pouvoir
    // constater une révocation, sinon le champ `revoked` ment. On ne republie
    // pas pour autant les données personnelles du titulaire rejeté : seul le
    // statut de révocation est exposé.
    if (attestation.status === 'REJECTED') {
      return NextResponse.json({
        attestation: {
          code: attestation.code,
          status: attestation.status,
          proof: {
            algorithm: seal.algorithm,
            sealed: seal.sealed,
            valid: false,
            reason: "certificat révoqué : l'attestation a été rejetée et n'est plus valable",
            revoked: true,
            status: attestation.status,
            sealedAt: attestation.sealedAt,
            sealVersion: seal.sealVersion,
            checkedAt: new Date().toISOString(),
          },
        },
      })
    }

    // Le score publié dépend du type de document réellement disponible en base.
    const responseData = {
      ...attestation,
      score: attestation.certificationScore ?? attestation.stageScore ?? 0,
      proof: {
        algorithm: seal.algorithm,
        sealed: seal.sealed,
        valid: seal.valid,
        reason: seal.reason ?? null,
        // Seules les attestations VALIDATED / CLAIMED atteignent ce point
        // (les REJECTED ont été traitées ci-dessus) : aucune révocation ici.
        revoked: false,
        status: attestation.status,
        sealedAt: attestation.sealedAt,
        sealVersion: seal.sealVersion,
        pdf: {
          available: Boolean(attestation.pdfKey),
          version: attestation.pdfVersion,
          hash: attestation.pdfHash,
          generatedAt: attestation.pdfGeneratedAt,
          downloadPath: attestation.pdfKey ? officialPdfDownloadPath(attestation.code) : null,
        },
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
