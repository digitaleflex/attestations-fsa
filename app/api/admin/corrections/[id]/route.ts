// app/api/admin/corrections/[id]/route.ts
// Admin route for approving/rejecting a correction request
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated, getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const CorrectionActionSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().max(500).optional(),
});

// PATCH - Approve or reject a correction request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const admin = await getCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const parse = CorrectionActionSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Entrée invalide", details: parse.error.errors },
        { status: 400 }
      );
    }

    const { action, reason } = parse.data;

    // Find the correction request
    const correction = await prisma.correctionRequest.findUnique({
      where: { id },
      include: { user: true, attestation: true },
    });

    if (!correction) {
      return NextResponse.json(
        { error: "Demande de correction non trouvée" },
        { status: 404 }
      );
    }

    if (correction.status !== "PENDING") {
      return NextResponse.json(
        { error: "Cette demande a déjà été traitée" },
        { status: 400 }
      );
    }

    // Update the correction request status
    const updated = await prisma.correctionRequest.update({
      where: { id },
      data: { status: action },
    });

    // If approved, apply the correction to the user profile
    if (action === "APPROVED" && correction.field) {
      const updateData: Record<string, unknown> = {};
      updateData[correction.field] = correction.newValue;

      await prisma.user.update({
        where: { id: correction.userId },
        data: updateData,
      });

      // If the correction was on an attestation, update it too
      if (correction.attestationId) {
        const attestationUpdate: Record<string, unknown> = {};
        attestationUpdate[correction.field] = correction.newValue;

        await prisma.attestation.update({
          where: { id: correction.attestationId },
          data: attestationUpdate,
        });
      }
    }

    // Log the action
    console.log(
      `[AUDIT] Admin ${(admin as any)?.email || 'unknown'} ${action} correction ${id} ` +
      `for user ${correction.userId} (field: ${correction.field})`
    );

    return NextResponse.json({
      message: `Demande ${action === "APPROVED" ? "approuvée" : "rejetée"} avec succès`,
      correction: updated,
    });
  } catch (error) {
    console.error("[PATCH /api/admin/corrections/[id] ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement de la demande" },
      { status: 500 }
    );
  }
}

// GET - Get a single correction request
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const correction = await prisma.correctionRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        attestation: { select: { id: true, code: true, fullName: true } },
      },
    });

    if (!correction) {
      return NextResponse.json(
        { error: "Demande de correction non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json(correction);
  } catch (error) {
    console.error("[GET /api/admin/corrections/[id] ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la demande" },
      { status: 500 }
    );
  }
}
