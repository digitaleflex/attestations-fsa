// app/api/user/send-verification/route.ts
// Envoi d'un email de vérification d'adresse email
// Token unique avec expiration 24h
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { handleApiError, ApiErrorImpl, ErrorTypes } from '@/lib/error-handler'
import { applyRateLimit } from '@/lib/rate-limit'
import { getAuth } from '@/lib/auth'
import { sanitizeInput } from '@/lib/sanitization'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    // ✅ Rate limiting - 5 envois par heure
    const rateLimit = await applyRateLimit(request as any, 'emailVerification')
    if (!rateLimit.allowed && rateLimit.response) {
      return rateLimit.response
    }

    // Vérifier l'authentification
    const auth = await getAuth()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      throw new ApiErrorImpl('UNAUTHORIZED', 'Non autorisé - Authentification requise')
    }

    const user = await prisma.user.findUnique({ 
      where: { id: session.user.id },
      select: { 
        id: true, 
        email: true, 
        name: true,
        emailVerified: true
      }
    })
    
    if (!user) {
      throw new ApiErrorImpl('NOT_FOUND', 'Utilisateur non trouvé')
    }

    // Vérifier si l'email est déjà vérifié
    if (user.emailVerified) {
      throw new ApiErrorImpl('CONFLICT', 'Email déjà vérifié')
    }

    // Générer un token unique
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24 heures

    // Supprimer les anciens tokens de vérification
    await prisma.verification.deleteMany({
      where: {
        identifier: { startsWith: 'email_verify:' },
        value: { startsWith: user.id }
      }
    })

    // Stocker le token
    await prisma.verification.create({
      data: {
        identifier: `email_verify:${user.id}`,
        value: token,
        expiresAt,
      }
    })

    // Générer le lien de vérification
    const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/verify-email?token=${token}`
    
    // Envoyer l'email
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Ferme St André <noreply@votre-domaine.com>',
      to: user.email!,
      subject: 'Vérifiez votre adresse email',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Vérification d'email</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">📧 Vérification d'email</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Bonjour ${user.name || 'Utilisateur'},
              </p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Merci de vous être inscrit sur notre plateforme. Pour finaliser votre inscription, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyLink}" 
                   style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Vérifier mon email
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Ou copiez-collez ce lien dans votre navigateur :
              </p>
              
              <p style="background: #f0f0f0; padding: 10px; border-radius: 5px; font-size: 12px; word-break: break-all; text-align: center;">
                ${verifyLink}
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="font-size: 14px; color: #666;">
                ⏰ <strong>Ce lien est valable 24 heures.</strong>
              </p>
              
              <p style="font-size: 14px; color: #666;">
                🔒 Si vous n'avez pas créé de compte, ignorez cet email.
              </p>
              
              <p style="font-size: 14px; color: #999; margin-top: 30px;">
                Cordialement,<br>
                L'équipe Ferme St André
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
              <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
            </div>
          </body>
        </html>
      `,
      text: `
        Vérification d'email
        
        Bonjour ${user.name || 'Utilisateur'},
        
        Merci de vous être inscrit sur notre plateforme.
        
        Pour vérifier votre email, cliquez sur ce lien (valable 24 heures) :
        ${verifyLink}
        
        Si vous n'avez pas créé de compte, ignorez cet email.
        
        Cordialement,
        L'équipe Ferme St André
      `,
    })

    return NextResponse.json({ 
      message: 'Email de vérification envoyé avec succès',
      success: true
    })

  } catch (error: any) {
    console.error('Send verification error:', error)
    return handleApiError(error, {
      route: '/api/user/send-verification',
      operation: 'send_verification',
    })
  }
}
