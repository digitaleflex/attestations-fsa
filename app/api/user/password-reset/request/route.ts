// app/api/user/password-reset/request/route.ts
// Demande de réinitialisation de mot de passe
// Envoi d'un email avec token unique et expiration
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { z } from 'zod'
import { handleApiError, ApiErrorImpl, ErrorTypes } from '@/lib/error-handler'
import { applyRateLimit } from '@/lib/rate-limit'
import { sanitizeInput } from '@/lib/sanitization'

const resend = new Resend(process.env.RESEND_API_KEY)

// Schéma de validation
const RequestSchema = z.object({
  email: z.string().email('Email invalide'),
})

export async function POST(request: Request) {
  try {
    // ✅ Rate limiting - 3 demandes par heure
    const rateLimit = await applyRateLimit(request as any, 'passwordReset')
    if (!rateLimit.allowed && rateLimit.response) {
      return rateLimit.response
    }

    const body = await request.json()
    const parse = RequestSchema.safeParse(body)
    
    if (!parse.success) {
      throw new ApiErrorImpl('VALIDATION', 'Email invalide')
    }

    const { email } = parse.data
    
    // Sanitization
    const sanitizedEmail = sanitizeInput(email)

    // Chercher l'utilisateur
    const user = await prisma.user.findUnique({ 
      where: { email: sanitizedEmail },
      select: { 
        id: true, 
        email: true, 
        name: true,
        emailVerified: true
      }
    })
    
    // ⚠️ Toujours répondre OK pour ne pas révéler l'existence du compte
    // C'est une bonne pratique de sécurité
    const genericMessage = "Si cet email existe, un lien de réinitialisation a été envoyé."
    
    if (!user) {
      return NextResponse.json({ message: genericMessage })
    }

    // Générer un token unique cryptographiquement sûr
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)  // 1 heure

    // Supprimer les anciens tokens de réinitialisation
    await prisma.verification.deleteMany({
      where: {
        identifier: { startsWith: 'password_reset:' },
        value: { startsWith: user.id }
      }
    })

    // Stocker le token dans la table Verification
    await prisma.verification.create({
      data: {
        identifier: `password_reset:${user.id}`,
        value: token,
        expiresAt,
      }
    })

    // Générer le lien de réinitialisation
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(sanitizedEmail)}`
    
    // Envoyer l'email
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Ferme St André <noreply@votre-domaine.com>',
      to: sanitizedEmail,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Réinitialisation de mot de passe</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Réinitialisation de mot de passe</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Bonjour ${user.name || 'Utilisateur'},
              </p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour continuer :
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Ou copiez-collez ce lien dans votre navigateur :
              </p>
              
              <p style="background: #f0f0f0; padding: 10px; border-radius: 5px; font-size: 12px; word-break: break-all; text-align: center;">
                ${resetLink}
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="font-size: 14px; color: #666;">
                ⏰ <strong>Ce lien est valable 1 heure.</strong>
              </p>
              
              <p style="font-size: 14px; color: #666;">
                🔒 <strong>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</strong>
              </p>
              
              <p style="font-size: 14px; color: #666;">
                Ce lien ne peut être utilisé qu'une seule fois.
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
        Réinitialisation de mot de passe
        
        Bonjour ${user.name || 'Utilisateur'},
        
        Vous avez demandé à réinitialiser votre mot de passe.
        
        Lien de réinitialisation (valable 1 heure) :
        ${resetLink}
        
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        
        Cordialement,
        L'équipe Ferme St André
      `,
    })

    return NextResponse.json({ 
      message: genericMessage,
      success: true
    })

  } catch (error: any) {
    console.error('Password reset request error:', error)
    return handleApiError(error, {
      route: '/api/user/password-reset/request',
      operation: 'password_reset_request',
    })
  }
}
