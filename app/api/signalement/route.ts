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
    const rateLimit = await applyRateLimit(req as any, 'report')
    if (!rateLimit.allowed && rateLimit.response) {
      const ip = req.headers.get('x-forwarded-for') || 'unknown'
      console.warn(`[SECURITY] Rate limit exceeded for report from IP: ${ip}`)
      return rateLimit.response
    }

    const body = await req.json()
    const parse = SignalementSchema.safeParse(body)
    
    if (!parse.success) {
      return NextResponse.json({ 
        message: "Entrée invalide", 
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
    
    // Logger la création (pour monitoring)
    console.log(`[REPORT] Nouveau signalement créé: ${report.id}`)

    return NextResponse.json({ 
      success: true, 
      id: report.id,
      message: 'Signalement enregistré avec succès'
    })
    
  } catch (error: any) {
    console.error('Erreur création signalement:', error)
    return handleApiError(error, {
      route: '/api/signalement',
      operation: 'create_report',
    })
  }
}

export async function GET(req: NextRequest) {
  try {
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
    
  } catch (e: any) {
    console.error('Erreur récupération signalements:', e)
    return handleApiError(e, {
      route: '/api/signalement',
      operation: 'get_reports',
    })
  }
}
