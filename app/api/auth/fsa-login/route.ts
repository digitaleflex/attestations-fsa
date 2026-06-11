// app/api/auth/fsa-login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email';
import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { createHash } from 'crypto';
import { rateLimits } from '@/lib/rate-limit';

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

const generateOtp = customAlphabet('1234567890', 6);

const RequestOtpSchema = z.object({
  action: z.literal('request-otp'),
  fsaCode: z.string().min(5, "Le code FSA ou le hash doit faire au moins 5 caractères.").max(50),
});

const VerifyOtpSchema = z.object({
  action: z.literal('verify-otp'),
  fsaCode: z.string().min(5, "Le code FSA ou le hash doit faire au moins 5 caractères.").max(50),
  otp: z.string().length(6, "Le code de vérification doit contenir exactement 6 chiffres."),
});

const LoginSchema = z.discriminatedUnion('action', [RequestOtpSchema, VerifyOtpSchema]);

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local[local.length - 1]}@${domain}`;
}

async function findAttestationByCode(fsaCode: string) {
  const codeCleaned = fsaCode.trim();
  
  // Si le code fait 5 caractères, on fait une recherche par hash de fin (EndsWith)
  if (codeCleaned.length === 5) {
    return await prisma.attestation.findFirst({
      where: {
        code: {
          endsWith: `-${codeCleaned}`,
          mode: 'insensitive'
        }
      }
    });
  }

  // Sinon recherche exacte
  return await prisma.attestation.findUnique({
    where: {
      code: codeCleaned
    }
  });
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    const body = await request.json();
    const parse = LoginSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({
        message: "Données de connexion invalides.",
        details: parse.error.errors
      }, { status: 400 });
    }

    const data = parse.data;

    // Rate limiting — request-otp: 3/10min par IP
    if (data.action === 'request-otp') {
      const limiter = rateLimits.fsaOtpRequest;
      if (limiter) {
        const { success, reset } = await limiter.limit(`ip:${ip}`);
        if (!success) {
          return NextResponse.json(
            { message: "Trop de demandes. Réessayez dans quelques minutes." },
            { status: 429, headers: { 'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString() } }
          );
        }
      }
    }

    // Rate limiting — verify-otp: 5/15min par IP+code (anti brute-force ciblé)
    if (data.action === 'verify-otp') {
      const limiter = rateLimits.fsaOtpVerify;
      if (limiter) {
        const { success, reset } = await limiter.limit(`ip:${ip}:code:${data.fsaCode}`);
        if (!success) {
          return NextResponse.json(
            { message: "Trop de tentatives. Réessayez dans quelques minutes." },
            { status: 429, headers: { 'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString() } }
          );
        }
      }
    }

    // 1. Recherche de l'attestation
    const attestation = await findAttestationByCode(data.fsaCode);
    if (!attestation) {
      return NextResponse.json({
        message: "Aucun dossier trouvé avec ce code FSA. Veuillez vérifier la saisie."
      }, { status: 404 });
    }

    const email = attestation.email;
    if (!email) {
      return NextResponse.json({
        message: "Aucune adresse e-mail n'est associée à ce dossier. Veuillez contacter l'administration pour la renseigner."
      }, { status: 400 });
    }

    // --- ACTION : REQUEST OTP ---
    if (data.action === 'request-otp') {
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Nettoyer les anciens codes OTP en suspens pour cet email
      await prisma.verification.deleteMany({
        where: { identifier: email }
      });

      // Enregistrer le hash du code OTP (jamais le plaintext)
      await prisma.verification.create({
        data: {
          identifier: email,
          value: hashOtp(otp),
          expiresAt
        }
      });

      // Envoyer le mail contenant l'OTP
      const emailResult = await emailService.sendFsaLoginOTP(email, attestation.fullName, otp);
      if (!emailResult.success) {
        console.error("[FSA-LOGIN] Failed to send email:", emailResult.error);
        return NextResponse.json({
          message: "Erreur lors de l'envoi de l'e-mail de connexion. Veuillez réessayer."
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        emailMasked: maskEmail(email)
      });
    }

    // --- ACTION : VERIFY OTP ---
    if (data.action === 'verify-otp') {
      // Rechercher l'OTP valide (comparaison sur le hash)
      const verification = await prisma.verification.findFirst({
        where: {
          identifier: email,
          value: hashOtp(data.otp),
          expiresAt: { gte: new Date() }
        }
      });

      if (!verification) {
        return NextResponse.json({
          message: "Code de vérification invalide ou expiré."
        }, { status: 400 });
      }

      // Supprimer l'OTP pour éviter le rejeu
      await prisma.verification.delete({
        where: { id: verification.id }
      });

      // Récupérer ou créer l'utilisateur User
      let user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: attestation.fullName,
            role: 'user',
            attestationCode: attestation.code,
            attestationStatus: 'VALIDATED'
          }
        });
      }

      // Associer l'attestation à l'utilisateur si ce n'est pas fait
      if (attestation.userId !== user.id) {
        await prisma.attestation.update({
          where: { id: attestation.id },
          data: { userId: user.id }
        });
      }

      // Générer le token de session et l'enregistrer manuellement dans la table Session de Better Auth
      const sessionToken = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 40)();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours (config standard)

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          expiresAt,
          userAgent: request.headers.get('user-agent') || null,
          ipAddress: request.headers.get('x-forwarded-for') || null,
        }
      });

      // Définir le cookie de session sur le client
      const cookieStore = await cookies();
      const cookieName = process.env.NODE_ENV === "production" ? "__Secure-better-auth.session_token" : "better-auth.session_token";

      cookieStore.set(cookieName, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: session.expiresAt,
        path: "/"
      });

      return NextResponse.json({
        success: true
      });
    }

    return NextResponse.json({ message: "Action non prise en charge." }, { status: 400 });

  } catch (error) {
    console.error("[FSA-LOGIN] Fatal error:", error);
    return NextResponse.json({
      message: "Une erreur interne est survenue lors de la connexion."
    }, { status: 500 });
  }
}
