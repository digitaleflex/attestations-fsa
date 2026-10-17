// app/api/user/after-signup/route.ts
// Updates additional user fields (phone, birthPlace, address, birthDate, formationId) after sign-up
// These fields couldn't be sent during sign-up because Better Auth's additionalFields don't work properly
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  ConsentValidationError,
  isConsentType,
  recordConsents,
  type ConsentTypeName,
} from "@/lib/consent";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      console.warn("[AFTER_SIGNUP] Unauthorized: User not found in session. Cookie present:", request.headers.get("cookie") ? "yes" : "no");
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { phone, birthPlace, address, birthDate, formationId, consents } = body;

    // #153 — Consentements acceptés à l'inscription. Traités AVANT le profil :
    // si un consentement est invalide, on refuse tout (pas d'inscription à
    // moitié documentée). Le lot est écrit en transaction par recordConsents.
    if (consents !== undefined) {
      if (!Array.isArray(consents)) {
        return NextResponse.json({ error: "Consentements invalides" }, { status: 400 });
      }
      const invalid = consents.find(
        (c: unknown) =>
          typeof c !== "object" || c === null ||
          !isConsentType((c as { type?: unknown }).type) ||
          typeof (c as { granted?: unknown }).granted !== "boolean",
      );
      if (invalid) {
        return NextResponse.json(
          { error: "Consentement mal formé : { type, granted } attendus" },
          { status: 400 },
        );
      }

      try {
        await recordConsents(
          consents.map((c: { type: ConsentTypeName; granted: boolean }) => ({
            userId: user.id,
            type: c.type,
            granted: c.granted,
            ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
            userAgent: request.headers.get("user-agent") ?? null,
          })),
        );
      } catch (error) {
        if (error instanceof ConsentValidationError) {
          return NextResponse.json({ error: error.message }, { status: 422 });
        }
        console.error("[AFTER_SIGNUP_CONSENT_ERROR]", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
      }
    }

    const updateData: Record<string, unknown> = {};
    
    if (phone) updateData.phone = phone;
    if (birthPlace) updateData.birthPlace = birthPlace;
    if (address) updateData.address = address;
    
    if (birthDate) {
      const date = new Date(birthDate);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: "Date invalide" }, { status: 400 });
      }
      updateData.birthDate = date;
    }
    
    if (formationId) {
      const formation = await prisma.formation.findUnique({ where: { id: formationId } });
      if (!formation) {
        return NextResponse.json({ error: "Formation non trouvée" }, { status: 404 });
      }
      updateData.formationId = formationId;
    }

    // Les consentements ont pu être enregistrés sans aucun champ de profil :
    // dans ce cas on ne renvoie pas « aucune donnée à mettre à jour », qui
    // ferait croire à un no-op alors que l'écriture a bien eu lieu.
    if (Object.keys(updateData).length === 0) {
      return consents !== undefined
        ? NextResponse.json({ message: "Consentements enregistrés" })
        : NextResponse.json({ message: "Aucune donnée à mettre à jour" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({ message: "Profil mis à jour" });
  } catch (error) {
    console.error("[AFTER_SIGNUP_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
