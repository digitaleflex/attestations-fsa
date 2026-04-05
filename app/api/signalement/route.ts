// app/api/signalement/route.ts
// Route de signalement (whistleblowing) avec rate limiting et sanitization
// Endpoint public - protection renforcée contre le spam
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { NextRequest } from "next/server"
import { applyRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/error-handler'
import { sanitizeInput } from '@/lib/sanitization'
import { isAdminAuthenticated } from '@/lib/auth'
import { pusherServer } from '@/lib/pusher'

// Schéma de validation pour un signalement
const SignalementSchema = z.object({
  code: z.string().max(50).optional(),
  motif: z.string().min(1, "Le motif est obligatoire.").max(500),
  message: z.string().min(1, "Le message est obligatoire.").max(2000),
  email: z.string().email("Email invalide").optional().or(z.literal("")).transform(e => e || null),
})

export async function POST(req: Request) {
  try {
    // ✅ RATE LIMITING - 3 signalements maximum par heure
    const rateLimit = await applyRateLimit(req, 'report')
    if (!rateLimit.allowed && rateLimit.response) {
      const ip = req.headers.get('x-forwarded-for') || 'unknown'
      console.warn(`[SECURITY] Rate limit exceeded for report from IP: ${ip}`)
      return rateLimit.response
    }

    const body = await req.json()
    const parse = SignalementSchema.safeParse(body)

    if (!parse.success) {
      return NextResponse.json({
        error: "Entrée invalide",
        details: parse.error.errors
      }, { status: 400 })
    }

    let { code, motif, message, email } = parse.data

    // ✅ SANITIZATION - Nettoyer les entrées
    motif = sanitizeInput(motif)
    message = sanitizeInput(message)
    if (email) {
      email = sanitizeInput(email)
    }
    if (code) {
      code = sanitizeInput(code)
    }

    // Création du signalement
    const report = await prisma.report.create({
      data: {
        codeAttestation: code || null,
        motif,
        message,
        email: email || null,
      },
    })

    // Déclencher Pusher pour l'admin
    try {
      if (process.env.PUSHER_APP_ID) {
        await pusherServer.trigger("admin-events", "report", {
            id: report.id,
            motif: report.motif,
            time: report.createdAt
        });
      }
    } catch (pusherError) {
      console.error("Erreur Pusher Admin Report:", pusherError);
    }

    // Logger la création (pour monitoring)
    console.log(`[REPORT] Nouveau signalement créé: ${report.id}`)

    return NextResponse.json({
      success: true,
      id: report.id,
      message: 'Signalement enregistré avec succès'
    })

  } catch (error) {
    console.error('[SIGNALEMENT POST ERROR]', error)
    // ✅ FIX: Return proper JSON instead of relying on handleApiError
    return NextResponse.json(
      {
        error: 'Erreur lors de la création du signalement',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    // ✅ Sécurité : Lister les signalements est réservé aux admins
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const countOnly = url.searchParams.get('countOnly') === '1'

    if (id) {
      const report = await prisma.report.findUnique({ where: { id } })

      if (!report) {
        return NextResponse.json({
          message: "Signalement introuvable"
        }, { status: 404 })
      }

      return NextResponse.json(report)
    }

    // Si countOnly, retourner juste le nombre
    if (countOnly) {
      const count = await prisma.report.count()
      return NextResponse.json({ count })
    }

    // Retourner la liste complète (admin uniquement normalement)
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100  // Limiter à 100 résultats
    })

    return NextResponse.json(reports)

  } catch (e: unknown) {
    console.error('Erreur récupération signalements:', e)
    return handleApiError(e instanceof Error ? e : new Error(String(e)), {
      route: '/api/signalement',
      operation: 'get_reports',
    })
  }
}

/**
 * DELETE /api/signalement?id=...
 * Route historique pour la suppression via paramètre de requête
 */
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID manquant" }, { status: 400 })
    }

    await prisma.report.delete({ where: { id } })

    console.log(`[REPORT] Signalement supprimé via query param: ${id}`)
    return NextResponse.json({ success: true, message: "Signalement supprimé" })

  } catch (error: unknown) {
    return handleApiError(error instanceof Error ? error : new Error(String(error)), {
      route: '/api/signalement',
      operation: 'delete_report_query',
    })
  }
}
