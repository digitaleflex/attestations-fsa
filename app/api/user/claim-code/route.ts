// app/api/user/claim-code/route.ts
// Route pour réclamer une attestation via son code
// Protection : authentification Better Auth, validation stricte du code
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { handleApiError } from "@/lib/error-handler";
import { sanitizeInput } from "@/lib/sanitization";

// Schéma de validation pour le code d'attestation
const ClaimCodeSchema = z.object({
  codePart: z.string().min(5, "Code trop court (min 5 caractères)").max(50),
});

export async function POST(req: Request) {
  try {
    // ✅ Authentification avec Better Auth (unifié)
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification requise" },
        { status: 401 }
      );
    }

    // ❌ BLOQUER LES ADMINS : Les attestations doivent être liées à un compte USER
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: "Action non autorisée pour les administrateurs. Veuillez utiliser un compte candidat." },
        { status: 403 }
      );
    }

    // ✅ Validation des données
    const body = await req.json();
    const parse = ClaimCodeSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Entrée invalide", details: parse.error.errors },
        { status: 400 }
      );
    }

    const { codePart } = parse.data;
    const sanitizedCode = sanitizeInput(codePart.trim()).toLowerCase();

    // ✅ Recherche exacte d'abord, puis fallback sur suffixe (uniquement pour codes courts)
    let attestation;

    if (sanitizedCode.length <= 5) {
      // Pour les codes courts (5 caractères), recherche par suffixe
      attestation = await prisma.attestation.findFirst({
        where: {
          code: { endsWith: sanitizedCode },
          userId: null, // Uniquement si pas déjà liée
        },
      });
    } else {
      // Pour les codes longs, recherche exacte
      attestation = await prisma.attestation.findUnique({
        where: {
          code: sanitizedCode,
          userId: null,
        },
      });
    }

    if (!attestation) {
      return NextResponse.json(
        { error: "Aucune attestation correspondante trouvée ou déjà liée." },
        { status: 404 }
      );
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
