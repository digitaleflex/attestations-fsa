import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const CorrectionRequestSchema = z.object({
  field: z.string().min(1, "Le champ est requis"),
  newValue: z.string().min(1, "La nouvelle valeur est requise"),
  attestationId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    // ✅ FIX: Use Better Auth instead of custom cookie check
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification requise" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parse = CorrectionRequestSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Entrée invalide", details: parse.error.errors },
        { status: 400 }
      );
    }

    const { field, newValue, attestationId, reason } = parse.data;

    // Créer la demande de correction
    const correctionRequest = await prisma.correctionRequest.create({
      data: {
        userId: user.id,
        attestationId,
        field,
        newValue,
        reason,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Demande de correction envoyée !",
      data: correctionRequest,
    });
  } catch (error) {
    console.error("[POST /api/user/profile/correction ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la demande" },
      { status: 500 }
    );
  }
}
