// app/api/auth/fsa-login/route.ts
// Route de connexion par e-mail / code FSA + OTP.
// Protection : quotas fail-closed, correspondance EXACTE du code (aucune
// recherche partielle) — même stratégie que `app/api/user/claim-code` (#303).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
  applyRateLimit,
  applyRateLimitByUser,
  hashIdentifier,
} from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/sanitization";
import {
  accountBlockMessage,
  getAccountAccessByEmail,
  revokeUserSessions,
} from "@/lib/account-status";

/**
 * #303 — Plancher de longueur d'un identifiant de connexion.
 *
 * Un code FSA fait 25 caractères (`FSA-AAAA-MM-NNNNN-xxxxx`, invariant
 * `ATTESTATION_CODE_PATTERN`) : ce plancher ne peut donc pas resurfacer un code
 * légitime. Il existe pour une seule raison : les « 5 derniers caractères » ne
 * sont pas un code, et un fragment ne doit jamais atteindre la base. Il est
 * volontairement plus large que l'ancien minimum de 5 pour que le motif
 * « fragment court » ne puisse pas revenir par simple régression du seuil.
 *
 * L'alternative « e-mail » reste acceptée : `EMAIL_SHAPE` implique déjà 5
 * caractères, ce que la saisie validait déjà.
 */
const MIN_CODE_LENGTH = 8;

/** Code FSA déjà canonique (forme émise par `lib/attestations/issue.ts`). */
const FSA_CODE_CANONICAL = /^FSA-(\d{4})-M(\d{2})-(\d{5})-([0-9a-f]{5})$/;

/** Même forme, casse indifférente — sert à remettre la saisie en forme émise. */
const FSA_CODE_LOOSE = /^fsa-(\d{4})-m(\d{2})-(\d{5})-([0-9a-f]{5})$/i;

/** Forme d'une adresse e-mail : la seule autre façon d'identifier un dossier. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * #303 — Remet une saisie de code dans la forme EXACTE stockée en base.
 *
 * `Attestation.code` est une colonne `String @unique` : l'égalité PostgreSQL
 * est sensible à la casse. Un `toLowerCase()` global rendrait donc la route
 * incapable de trouver le moindre code réel, puisque tous les générateurs
 * émettent `FSA-…-xxxxx` avec un suffixe minuscule.
 *
 * On normalise donc la forme connue, et on laisse passer telle quelle toute
 * autre valeur (adresse e-mail comprise) : la recherche reste strictement
 * exacte, y compris pour une éventuelle ligne historique hors format FSA.
 * Aucune expression régulière n'est utilisée comme motif de recherche en base.
 */
function canonicalizeFsaCode(value: string): string {
  if (FSA_CODE_CANONICAL.test(value)) return value;
  return value.replace(
    FSA_CODE_LOOSE,
    (_match, year: string, month: string, sequence: string, suffix: string) =>
      `FSA-${year}-M${month}-${sequence}-${suffix.toLowerCase()}`,
  );
}

/**
 * Champ `fsaCode` partagé par les trois actions : e-mail OU code FSA complet.
 * La normalisation (nettoyage HTML + forme canonique) précède le contrôle de
 * longueur : c'est la valeur réellement passée en base qui est bornée, pas
 * l'entrée brute. Le refus du fragment ne dépend que de la FORME de la saisie,
 * donc d'un fragment on ne peut rien apprendre de plus que d'un identifiant
 * valide.
 */
const FsaCodeField = z
  .string()
  .transform((value) => canonicalizeFsaCode(sanitizeInput(value)))
  .refine((value) => value.length > 0, "Saisissez votre e-mail ou votre code FSA.")
  .refine((value) => value.length <= 50, "Le code saisi est trop long (max 50 caractères).")
  .refine(
    (value) => EMAIL_SHAPE.test(value) || value.length >= MIN_CODE_LENGTH,
    `Saisissez votre adresse e-mail complète ou votre code FSA complet (ex : FSA-2026-M01-00042-f0f9a). Un fragment du code n'est pas accepté.`,
  );

const RequestOtpSchema = z.object({
  action: z.literal("request-otp"),
  fsaCode: FsaCodeField,
});

const VerifyOtpSchema = z.object({
  action: z.literal("verify-otp"),
  fsaCode: FsaCodeField,
  otp: z
    .string()
    .length(6, "Le code de vérification doit contenir exactement 6 chiffres."),
});

const RequestMagicLinkSchema = z.object({
  action: z.literal("request-magic-link"),
  fsaCode: FsaCodeField,
});

const LoginSchema = z.discriminatedUnion("action", [
  RequestOtpSchema,
  VerifyOtpSchema,
  RequestMagicLinkSchema,
]);

/**
 * Réponse unique pour TOUT ce qui n'ouvre pas de session : identifiant
 * inconnu, code sans e-mail associé, dossier inexistant. Même statut, même
 * corps : l'énumération de dossiers n'a rien à lire sur la réponse.
 *
 * #303 — Avant, « code inconnu » répondait 404 et « code trouvé mais sans
 * e-mail » répondait 400 : ce seul couple de statuts suffisait à tester
 * l'existence d'un code, sans jamais deviner les 5 derniers caractères. Les
 * deux cas sont aujourd'hui indistinguables, comme « e-mail inconnu ».
 */
function unknownDossierResponse() {
  return NextResponse.json(
    {
      message:
        "Identifiant inconnu ou dossier indisponible. Veuillez vérifier votre e-mail ou votre code FSA.",
    },
    { status: 404 },
  );
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local[local.length - 1]}@${domain}`;
}

/**
 * #303 — Correspondance EXACTE, et rien d'autre.
 *
 * La version précédente cherchait `code: { endsWith: "-xxxxx" }` pour toute
 * saisie de 5 caractères : l'espace de recherche retombait à 20 bits, et le
 * couple 200/404 devenait un oracle sur un million d'attestations. Le suffixe
 * est supprimé : `Attestation.code` est `@unique`, le code entier identifie
 * l'attestation, et une égalité sur une colonne unique a un coût identique que
 * la ligne existe ou non.
 */
async function findAttestationByCode(code: string) {
  return await prisma.attestation.findUnique({
    where: { code },
  });
}

type AttestationRecord = Awaited<ReturnType<typeof findAttestationByCode>>;

export async function POST(request: Request) {
  try {
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

    // #303 — Quotas FAIL-CLOSED, comptés AVANT tout accès à la base.
    //
    // L'IP est lue par `lib/rate-limit` depuis le proxy de confiance
    // (`getClientIp`) et non depuis un `x-forwarded-for` brut : sans cela,
    // ajouter une IP inventée dans l'en-tête suffisait à recevoir un compteur
    // neuf à chaque requête, et le quota ne valait plus rien.
    //
    // Ces deux types de limite sont déclarés fail-closed dans
    // `FAIL_CLOSED_LIMIT_TYPES` : si le compteur distribué est indisponible, la
    // requête est REFUSÉE (503) au lieu de laisser passer le trafic — la
    // fenêtre exacte pendant laquelle une attaque de force brute passerait.
    // Un quota fail-closed n'est donc plus une simple limitation de débit.

    // request-otp / request-magic-link : 3/10min par IP (envoi d'e-mail).
    if (data.action === "request-otp" || data.action === "request-magic-link") {
      const limiter = await applyRateLimit(request, "fsaOtpRequest");
      if (!limiter.allowed) return limiter.response;
    }

    // verify-otp : 5/15min en DOUBLE comptage IP + dossier. Changer d'IP ne
    // rend pas un budget neuf face à un même code. Le seau « dossier » est un
    // condensat de l'identifiant canonique : le secret ne doit pas se retrouver
    // en clair dans une clé de compteur.
    if (data.action === "verify-otp") {
      const limiter = await applyRateLimitByUser(
        request,
        hashIdentifier(data.fsaCode),
        "fsaOtpVerify",
      );
      if (!limiter.allowed) return limiter.response;
    }

    // 1. Recherche par identifiant (e-mail ou code FSA complet)
    const inputCleaned = data.fsaCode.toLowerCase();
    const isEmail = EMAIL_SHAPE.test(inputCleaned);

    let email = "";
    let candidateName = "";
    let attestation: AttestationRecord = null;

    if (isEmail) {
      const user = await prisma.user.findUnique({
        where: { email: inputCleaned },
        select: { id: true, email: true, name: true, role: true },
      });

      if (!user) {
        return unknownDossierResponse();
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

      // Un dossier sans e-mail exploitable ne vaut pas mieux qu'un dossier
      // inexistant pour qui essaie de deviner le code : réponse identique.
      if (!foundAttestation?.email) {
        return unknownDossierResponse();
      }

      email = foundAttestation.email;
      candidateName = foundAttestation.fullName;
      attestation = foundAttestation;
    }

    // #304 — Statut de compte : un compte BLOCKED / SUSPENDED ne peut ni
    // demander ni valider un code de connexion. Contrôle effectué AVANT
    // l'envoi de l'OTP (injection d'information : ne pas révéler qu'un
    // dossier existe) et la session est révoquée si elle existait encore.
    const access = await getAccountAccessByEmail(email);
    if (!access.allowed && access.reason !== "NOT_FOUND") {
      await revokeUserSessions(access.user?.id ?? "");
      return NextResponse.json(
        { message: accountBlockMessage(access) },
        { status: 403 },
      );
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
