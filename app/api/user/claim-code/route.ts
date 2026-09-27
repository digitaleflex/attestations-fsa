// app/api/user/claim-code/route.ts
// Route pour réclamer une attestation via son code
// Protection : authentification Better Auth, quota fail-closed (#303),
// correspondance EXACTE du code (aucune recherche partielle).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { handleApiError } from "@/lib/error-handler";
import { sanitizeInput } from "@/lib/sanitization";
import { applyRateLimitByUser } from "@/lib/rate-limit";

/**
 * #303 — Plancher de longueur du code soumis.
 *
 * Un code FSA fait 25 caractères (`FSA-AAAA-MM-NNNNN-xxxxx`, invariant
 * `ATTESTATION_CODE_PATTERN`) : ce plancher ne peut donc pas resurfacer un code
 * légitime. Il existe pour une seule raison : les « 5 derniers caractères » ne
 * sont pas un code, et un fragment ne doit jamais atteindre la base. Il est
 * volontairement plus large que l'ancien minimum de 5 pour que le motif
 * « fragment court » ne puisse pas revenir par simple régression du seuil.
 */
const MIN_CODE_LENGTH = 8;

/** Code FSA déjà canonique (forme émise par `lib/attestations/issue.ts`). */
const FSA_CODE_CANONICAL = /^FSA-(\d{4})-M(\d{2})-(\d{5})-([0-9a-f]{5})$/;

/** Même forme, casse indifférente — sert à remettre la saisie en forme émise. */
const FSA_CODE_LOOSE = /^fsa-(\d{4})-m(\d{2})-(\d{5})-([0-9a-f]{5})$/i;

/**
 * #303 — Remet une saisie de code dans la forme EXACTE stockée en base.
 *
 * `Attestation.code` est une colonne `String @unique` : l'égalité PostgreSQL
 * est sensible à la casse. Un `toLowerCase()` global (ancien comportement)
 * rendait donc la route incapable de trouver le moindre code réel, puisque
 * tous les générateurs émettent `FSA-…-xxxxx` avec un suffixe minuscule.
 *
 * On normalise donc la forme connue, et on laisse passer telle quelle toute
 * autre valeur : la recherche reste strictement exacte, y compris pour une
 * éventuelle ligne historique hors format FSA. Aucune expression régulière
 * n'est utilisée comme motif de recherche en base.
 */
function canonicalizeClaimCode(value: string): string {
  if (FSA_CODE_CANONICAL.test(value)) return value;
  return value.replace(
    FSA_CODE_LOOSE,
    (_match, year: string, month: string, sequence: string, suffix: string) =>
      `FSA-${year}-M${month}-${sequence}-${suffix.toLowerCase()}`,
  );
}

/**
 * Schéma de validation du code d'attestation.
 * La normalisation (nettoyage HTML + forme canonique) précède le contrôle de
 * longueur : c'est la valeur réellement passée en base qui est bornée, pas
 * l'entrée brute.
 */
const ClaimCodeSchema = z.object({
  codePart: z
    .string()
    .transform((value) => canonicalizeClaimCode(sanitizeInput(value)))
    .refine(
      (value) => value.length >= MIN_CODE_LENGTH,
      `Code trop court (min ${MIN_CODE_LENGTH} caractères)`,
    )
    .refine((value) => value.length <= 50, "Code trop long (max 50 caractères)"),
});

/**
 * Réponse unique pour « code inconnu » ET « code déjà lié à un compte ».
 * Même statut, même corps : l'énumération de codes n'a rien à lire sur la
 * réponse. La requête porte déjà `userId: null`, donc ces deux cas sont
 * indistinguables côté base comme côté HTTP — et le chemin de code non trouvé
 * n'exécute aucune requête supplémentaire, donc pas de fuite par timing.
 */
function unknownCodeResponse() {
  return NextResponse.json(
    { error: "Aucune attestation correspondante trouvée ou déjà liée." },
    { status: 404 },
  );
}

export async function POST(req: Request) {
  try {
    // ✅ Authentification avec Better Auth (unifié)
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification requise" },
        { status: 401 },
      );
    }

    // #303 — Le code de réclamation est un SECRET : retrouver une attestation
    // revient à deviner les 5 caractères hexadécimaux de fin de
    // `FSA-2026-M01-00042-xxxxx`, soit 20 bits d'entropie et 1 048 576
    // combinaisons. Sans quota, cette route est un oracle de force brute
    // (une réponse 200 « ça existe » par code essayé).
    //
    // Quota fail-closed en double comptage IP + utilisateur (changer d'IP ne
    // rend pas un budget neuf) : REFUS 503 si le compteur distribué est
    // indisponible — pas de filet mémoire fail-open sur un oracle de secret,
    // contrairement aux endpoints non sensibles.
    //
    // Le quota s'applique APRÈS l'authentification et AVANT tout accès à la
    // base : aucun appelant authentifié (administrateur compris) ne garde un
    // chemin non compté vers cette route.
    const rateLimit = await applyRateLimitByUser(req, user.id, "claimCode");
    if (!rateLimit.allowed) return rateLimit.response;

    // ❌ BLOQUER LES ADMINS : Les attestations doivent être liées à un compte USER
    if (user.role?.toLowerCase() === "admin") {
      return NextResponse.json(
        { error: "Action non autorisée pour les administrateurs. Veuillez utiliser un compte candidat." },
        { status: 403 },
      );
    }

    // ✅ Validation des données
    const body = await req.json();
    const parse = ClaimCodeSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Entrée invalide", details: parse.error.errors },
        { status: 400 },
      );
    }

    const sanitizedCode = parse.data.codePart;

    // ✅ Correspondance EXACTE, et rien d'autre.
    //
    // #303 — La version précédente cherchait `code: { endsWith: sanitizedCode }`
    // pour toute saisie de 5 caractères ou moins : l'espace de recherche
    // retombait à 20 bits, et le couple 200/404 devenait un oracle sur un
    // million d'attestations VALIDATED non rattachées. Le suffixe est
    // supprimé : `Attestation.code` est `@unique`, le code entier identifie
    // l'attestation, et une égalité sur une colonne unique a un coût identique
    // que la ligne existe ou non.
    const attestation = await prisma.attestation.findFirst({
      where: {
        code: sanitizedCode,
        userId: null,
        status: "VALIDATED",
      },
    });

    if (!attestation) {
      return unknownCodeResponse();
    }

    // ✅ Transaction atomique : lier l'attestation + mettre à jour le profil
    await prisma.$transaction([
      // Lier l'attestation à l'utilisateur
      prisma.attestation.update({
        where: { id: attestation.id },
        data: { userId: user.id },
      }),

      // Mettre à jour le profil de l'utilisateur avec les données de l'attestation
      prisma.user.update({
        where: { id: user.id },
        data: {
          name: attestation.fullName,
          birthDate: attestation.birthDate,
          birthPlace: attestation.birthPlace,
          gender: attestation.gender,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Attestation liée avec succès !",
      data: {
        fullName: attestation.fullName,
        birthDate: attestation.birthDate,
        birthPlace: attestation.birthPlace,
      },
    });
  } catch (error: unknown) {
    console.error("[CLAIM_CODE_ERROR]", error);
    return handleApiError(error instanceof Error ? error : new Error(String(error)), {
      route: "/api/user/claim-code",
      operation: "claim_attestation",
    });
  }
}
