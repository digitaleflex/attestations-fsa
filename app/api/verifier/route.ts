// app/api/verifier/route.ts
// Route de vérification d'attestation avec rate limiting
// Endpoint public - protection contre le scraping
//
// #281 — la réponse est une WHITELIST stricte de champs publics (voir le bloc
// de construction de `responseData`) : plus aucun spread de la ligne Prisma.
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
    // On expose la vérification pour les attestations VALIDATED / CLAIMED, et
    // on charge aussi REJECTED et REVOKED pour pouvoir signaler une révocation
    // explicite au lieu de la déclarer introuvable (#224). Depuis #299/#301 la
    // révocation d'un document DÉJÀ émis a son propre statut `REVOKED` :
    // l'ignorer ferait répondre 404 « aucun certificat » à un tiers qui scanne
    // un PDF imprimé, c'est-à-dire lui affirmer que la révocation n'existe pas.
    //
    // #299/#301 — les lignes supprimées LOGIQUEMENT (`deletedAt` non nul) ne
    // sont JAMAIS publiées : la suppression logique est une décision
    // d'administration (erreur de saisie, demande du titulaire), pas un statut
    // opposable au tiers, et publier un statut « supprimée » confirmerait
    // l'existence d'une ligne retirée du registre tout en exposant un
    // document sans son document officiel. Choix assumé : 404 générique,
    // strictement identique à celui d'un code inexistant — donc zéro
    // information supplémentaire divulguée.
    // SELECT DE TRAVAIL (#281) : charge tout ce dont le recalcul du scellement
    // a besoin (y compris des PII). Ces champs ne sont JAMAIS publiés — la
    // réponse publique est construite par whitelist explicite plus bas.
    const attestation = await prisma.attestation.findFirst({
      where: {
        code: { equals: validCode, mode: 'insensitive' },
        status: { in: ['VALIDATED', 'CLAIMED', 'REJECTED', 'REVOKED'] },
        deletedAt: null,
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

    // Révocation (#224, #299/#301) : le code existe mais l'attestation a été
    // rejetée à l'émission (REJECTED) ou révoquée après émission (REVOKED).
    // On le déclare explicitement — un vérificateur public doit pouvoir
    // constater une révocation, sinon le champ `revoked` ment. On ne republie
    // pas pour autant les données personnelles du titulaire ni les traces
    // internes de la décision : `revokeReason`, `revokedById`, `revokedAt`,
    // `deleteReason`, `deletedById` restent hors de la whitelist (#281), seuls
    // le statut et un motif PUBLIC générique sont publiés.
    if (attestation.status === 'REJECTED' || attestation.status === 'REVOKED') {
      return NextResponse.json({
        attestation: {
          code: attestation.code,
          status: attestation.status,
          proof: {
            algorithm: seal.algorithm,
            sealed: seal.sealed,
            valid: false,
            reason:
              attestation.status === 'REVOKED'
                ? "certificat révoqué : l'attestation a été révoquée et n'est plus valable"
                : "certificat révoqué : l'attestation a été rejetée et n'est plus valable",
            revoked: true,
            status: attestation.status,
            sealedAt: attestation.sealedAt,
            sealVersion: seal.sealVersion,
            checkedAt: new Date().toISOString(),
          },
        },
      })
    }

    // ✅ WHITELIST PUBLIQUE (#281) — la réponse ne doit dépendre d'AUCUN spread
    // de la ligne Prisma. Le `select` ci-dessus charge tout ce dont le
    // recalcul du scellement a besoin (PII incluse) : c'est une donnée de
    // travail interne, jamais une donnée publiée. Toute nouvelle colonne
    // ajoutée au modèle reste donc privée par défaut, au lieu de fuiter
    // silencieusement à chaque appel public.
    //
    // Publie : l'identité du document (code / id), le nom du titulaire, le
    // type, le statut, les dates de validité, le score, la formation, et la
    // preuve (scellement + métadonnées du PDF). Sont volontairement exclus :
    // email, gender, birthDate, birthPlace, location, instructor,
    // issuingCompany, observations internes, userId, sessionId, formationId,
    // pdfKey/pdfHash bruts (redistribués via la preuve) et sealHash.
    const responseData = {
      id: attestation.id,
      code: attestation.code,
      fullName: attestation.fullName,
      type: attestation.type,
      status: attestation.status,
      startDate: attestation.startDate,
      endDate: attestation.endDate,
      issuedAt: attestation.issuedAt,
      formation: attestation.formation
        ? { name: attestation.formation.name, category: attestation.formation.category }
        : null,
      score: attestation.certificationScore ?? attestation.stageScore ?? 0,
      proof: {
        algorithm: seal.algorithm,
        sealed: seal.sealed,
        valid: seal.valid,
        reason: seal.reason ?? null,
        // Seules les attestations VALIDATED / CLAIMED atteignent ce point
        // (REJECTED et REVOKED ont été traitées ci-dessus) : aucune
        // révocation ici. Le nouveau statut `REVOKED` de #299/#301 ne
        // publie QUE le statut via cette branche minimale — jamais
        // revokeReason / revokedById / revokedAt.
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
