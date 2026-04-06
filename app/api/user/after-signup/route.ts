// app/api/user/after-signup/route.ts
// Updates additional user fields (birthDate, formationId) after sign-up
// These fields couldn't be sent during sign-up due to Better Auth serialization limits
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { birthDate, formationId } = body;

    const updateData: Record<string, unknown> = {};
    
    if (birthDate) {
      // Validate date format
      const date = new Date(birthDate);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: "Date invalide" }, { status: 400 });
      }
      updateData.birthDate = date;
    }
    
    if (formationId) {
      // Verify formation exists
      const formation = await prisma.formation.findUnique({ where: { id: formationId } });
      if (!formation) {
        return NextResponse.json({ error: "Formation non trouvée" }, { status: 404 });
      }
      updateData.formationId = formationId;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "Aucune donnée à mettre à jour" });
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
