// app/api/auth/fsa-login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { rateLimits } from "@/lib/rate-limit";

const RequestOtpSchema = z.object({
  action: z.literal("request-otp"),
  fsaCode: z
    .string()
    .min(5, "Le code FSA ou le hash doit faire au moins 5 caractères.")
    .max(50),
});

const VerifyOtpSchema = z.object({
  action: z.literal("verify-otp"),
  fsaCode: z
    .string()
    .min(5, "Le code FSA ou le hash doit faire au moins 5 caractères.")
    .max(50),
  otp: z
    .string()
    .length(6, "Le code de vérification doit contenir exactement 6 chiffres."),
});

const RequestMagicLinkSchema = z.object({
  action: z.literal("request-magic-link"),
  fsaCode: z
    .string()
    .min(5, "Le code FSA ou le hash doit faire au moins 5 caractères.")
    .max(50),
});

const LoginSchema = z.discriminatedUnion("action", [
  RequestOtpSchema,
  VerifyOtpSchema,
  RequestMagicLinkSchema,
]);

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
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
          mode: "insensitive",
        },
      },
    });
  }

  // Sinon recherche exacte
  return await prisma.attestation.findUnique({
    where: {
      code: codeCleaned,
    },
  });
}

type AttestationRecord = Awaited<ReturnType<typeof findAttestationByCode>>;

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";

    const body = await request.json();
    const parse = LoginSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        {
          message: "Données de connexion invalides.",
          details: parse.error.errors,
        },
        { status: 400 },
      );
    }

    const data = parse.data;

    // Rate limiting — request-otp / request-magic-link: 3/10min par IP
    if (data.action === "request-otp" || data.action === "request-magic-link") {
      const limiter = rateLimits.fsaOtpRequest;
      if (limiter) {
        const { success, reset } = await limiter.limit(`ip:${ip}`);
        if (!success) {
          return NextResponse.json(
            { message: "Trop de demandes. Réessayez dans quelques minutes." },
            {
              status: 429,
              headers: {
                "Retry-After": Math.ceil(
                  (reset - Date.now()) / 1000,
                ).toString(),
              },
            },
          );
        }
      }
    }

    // Rate limiting — verify-otp: 5/15min par IP+code (anti brute-force ciblé)
    if (data.action === "verify-otp") {
      const limiter = rateLimits.fsaOtpVerify;
      if (limiter) {
        const { success, reset } = await limiter.limit(
          `ip:${ip}:code:${data.fsaCode}`,
        );
        if (!success) {
          return NextResponse.json(
            { message: "Trop de tentatives. Réessayez dans quelques minutes." },
            {
              status: 429,
              headers: {
                "Retry-After": Math.ceil(
                  (reset - Date.now()) / 1000,
                ).toString(),
              },
            },
          );
        }
      }
    }

    // 1. Recherche hybride (E-mail ou Code FSA)
    const inputCleaned = data.fsaCode.trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputCleaned);

    let email = "";
    let candidateName = "";
    let attestation: AttestationRecord = null;

    if (isEmail) {
      const user = await prisma.user.findUnique({
        where: { email: inputCleaned },
        select: { id: true, email: true, name: true, role: true },
      });

      if (!user) {
        return NextResponse.json(
          {
            message:
              "Aucun compte candidat n'est associé à cette adresse e-mail. Veuillez contacter l'administration.",
          },
          { status: 404 },
        );
      }

      if (user.role?.toLowerCase() === "admin") {
        return NextResponse.json(
          {
            message:
              "Accès refusé. Les administrateurs doivent utiliser l'interface de connexion dédiée.",
          },
          { status: 403 },
        );
      }

      email = user.email || inputCleaned;
      candidateName = user.name || "Candidat";
    } else {
      const foundAttestation = await findAttestationByCode(data.fsaCode);
      if (!foundAttestation) {
        return NextResponse.json(
          {
            message:
              "Aucun dossier trouvé avec ce code FSA. Veuillez vérifier la saisie.",
          },
          { status: 404 },
        );
      }

      if (!foundAttestation.email) {
        return NextResponse.json(
          {
            message:
              "Aucune adresse e-mail n'est associée à ce dossier. Veuillez contacter l'administration pour la renseigner.",
          },
          { status: 400 },
        );
      }

      email = foundAttestation.email;
      candidateName = foundAttestation.fullName;
      attestation = foundAttestation;
    }

    // --- ACTION : REQUEST OTP ---
    if (data.action === "request-otp") {
      // Better Auth génère l'OTP, l'enregistre et envoie le mail via
      // sendVerificationOTP (type "sign-in"). Aucune session n'est créée ici.
      const otpResponse = await auth.api.sendVerificationOTP({
        body: { email, type: "sign-in" },
        headers: request.headers,
        asResponse: true,
      });

      if (!otpResponse.ok) {
        console.error(
          "[FSA-LOGIN] sendVerificationOTP failed:",
          otpResponse.status,
        );
        return NextResponse.json(
          {
            message:
              "Erreur lors de l'envoi de l'e-mail de connexion. Veuillez réessayer.",
          },
          { status: 500 },
        );
      }

      const response = NextResponse.json({
        success: true,
        email: maskEmail(email),
        // Conservé pour compatibilité avec l'UI existante.
        emailMasked: maskEmail(email),
        name: candidateName,
      });

      // Transmettre d'éventuels cookies signés émis par Better Auth.
      for (const cookie of otpResponse.headers.getSetCookie()) {
        response.headers.append("set-cookie", cookie);
      }

      return response;
    }

    // --- ACTION : VERIFY OTP ---
    if (data.action === "verify-otp") {
      // Refuser la connexion OTP aux administrateurs (interface dédiée requise)
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });

      if (existingUser?.role?.toLowerCase() === "admin") {
        return NextResponse.json(
          {
            message:
              "Accès refusé. Les administrateurs doivent utiliser /admin/login.",
          },
          { status: 403 },
        );
      }

      // Better Auth valide l'OTP, crée l'utilisateur si absent, crée la session
      // et émet le cookie de session SIGNÉ (HMAC) via Set-Cookie.
      const signInResponse = await auth.api.signInEmailOTP({
        body: { email, otp: data.otp },
        headers: request.headers,
        asResponse: true,
      });

      if (!signInResponse.ok) {
        return NextResponse.json(
          { message: "Code de vérification invalide ou expiré." },
          { status: signInResponse.status === 401 ? 401 : 400 },
        );
      }

      // Récupérer l'utilisateur (auto-créé par Better Auth si absent)
      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Associer l'attestation à l'utilisateur si ce n'est pas déjà fait
      if (attestation && user && attestation.userId !== user.id) {
        await prisma.attestation.update({
          where: { id: attestation.id },
          data: { userId: user.id },
        });
      }

      const response = NextResponse.json({
        success: true,
        role: user?.role ?? "user",
      });

      // Recopier les cookies signés émis par Better Auth (session_token, etc.)
      for (const cookie of signInResponse.headers.getSetCookie()) {
        response.headers.append("set-cookie", cookie);
      }

      return response;
    }

    // --- ACTION : REQUEST MAGIC LINK (désactivée) ---
    if (data.action === "request-magic-link") {
      return NextResponse.json(
        {
          message:
            "La connexion par lien magique est désactivée. Utilisez le code de vérification (OTP) envoyé par e-mail.",
        },
        { status: 410 },
      );
    }

    return NextResponse.json(
      { message: "Action non prise en charge." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[FSA-LOGIN] Fatal error:", error);
    return NextResponse.json(
      {
        message: "Une erreur interne est survenue lors de la connexion.",
      },
      { status: 500 },
    );
  }
}
